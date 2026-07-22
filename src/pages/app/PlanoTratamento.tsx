import { useEffect, useMemo, useState, useCallback } from "react";
import { HelpCard } from "@/components/app/HelpCard";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, X, FileDown, ClipboardList, Target, Sparkles, History, Stethoscope, ArrowLeft, Pencil } from "lucide-react";
import { PlanoTratamentoHub } from "@/components/app/PlanoTratamentoHub";
import { DSM5Diagnostic, type DSM5Detail, type DSM5HistoryItem, getDsm5EntryByLabel } from "@/components/app/DSM5Diagnostic";
import { DSM5MultiDiagnostic } from "@/components/app/DSM5MultiDiagnostic";
import { toast } from "sonner";
import { preserveScroll } from "@/lib/preserveScroll";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/app/PageIntro";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { SessionPlanningForm, type SessionPlanningValue, planningValueFromDb } from "@/components/app/SessionPlanningForm";

type Patient = {
  id: string;
  full_name: string;
  is_active: boolean;
  treatment_start_date: string | null;
  treatment_end_date: string | null;
};
type GoalType = "geral" | "intermediaria" | "comportamental";

interface TreatmentPlan {
  id?: string;
  status: string;
  cid: string;
  abordagem: string[];
  conceitualizacao: string;
}
interface Goal { id: string; tipo: GoalType; descricao: string; ordem: number }
interface Technique { id: string; nome: string }
interface SessionPlan {
  id?: string;
  session_id: string | null;
  objetivo: string;
  meta_id: string | null;
  retomar: string;
  tecnicas: string[];
  observacoes: string;
}
interface Revision { id: string; data: string; sessao_ref: string; descricao: string }
interface NextSession { id: string; scheduled_at: string; duration_minutes: number }
interface TreatmentSession { id: string; scheduled_at: string; duration_minutes: number; status: string; notes: string | null }

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "alta", label: "Alta" },
];
const ABORDAGEM_OPTIONS = ["TCC", "TE", "ACT", "Outra"];
const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};
const GOAL_META = {
  geral:          { label: "Geral",          border: "border-l-primary", chip: "bg-secondary text-primary-dark" },
  intermediaria:  { label: "Intermediária",  border: "border-l-[#BA7517]", chip: "bg-[#fdf3e3] text-[#7a4a0a]" },
  comportamental: { label: "Comportamental", border: "border-l-moss", chip: "bg-[#e3f7ee] text-moss" },
} as const;

const PURPLE = "hsl(var(--primary))";

const PlanoTratamento = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryPatient = searchParams.get("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>(queryPatient || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState<TreatmentPlan>({ status: "ativo", cid: "", abordagem: [], conceitualizacao: "" });
  const [dsm5List, setDsm5List] = useState<DSM5Detail[]>([]);
  const [dsm5History, setDsm5History] = useState<DSM5HistoryItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [newTech, setNewTech] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [newRevisionOpen, setNewRevisionOpen] = useState(false);
  const [newRevisionDesc, setNewRevisionDesc] = useState("");
  const [newRevisionRef, setNewRevisionRef] = useState("");
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [treatmentSessions, setTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan>({
    session_id: null, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "",
  });

  // Planejamento — Sheet reutilizando o mesmo componente do Registro de Sessão
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningValue, setPlanningValue] = useState<SessionPlanningValue>({
    next_scheduled_at: "", next_objetivo: "", next_retomar: "", next_meta_id: null, next_tecnicas: [], next_observacoes: "",
  });
  const [planningSaving, setPlanningSaving] = useState(false);

  const openPlanningSheet = () => {
    setPlanningValue(planningValueFromDb({
      scheduled_at: nextSession?.scheduled_at ?? null,
      objetivo: sessionPlan.objetivo,
      retomar: sessionPlan.retomar,
      meta_id: sessionPlan.meta_id,
      tecnicas: sessionPlan.tecnicas,
      observacoes: sessionPlan.observacoes,
    }));
    setPlanningOpen(true);
  };

  const savePlanningFromSheet = async () => {
    if (!uid || !patientId) return;
    setPlanningSaving(true);
    try {
      await ensurePlan();
      // 1) Resolver sessão-alvo se houver data
      let targetSessionId: string | null = nextSession?.id ?? sessionPlan.session_id ?? null;
      if (planningValue.next_scheduled_at) {
        const iso = new Date(planningValue.next_scheduled_at).toISOString();
        if (targetSessionId) {
          await supabase.from("sessions").update({ scheduled_at: iso, status: "scheduled" })
            .eq("id", targetSessionId).eq("user_id", uid);
        } else {
          const { data: created } = await supabase.from("sessions").insert({
            user_id: uid, patient_id: patientId, scheduled_at: iso,
            duration_minutes: 50, modality: "presencial", status: "scheduled", session_type: "clinical",
          }).select("id").single();
          if (created?.id) targetSessionId = created.id;
        }
      }
      // 2) Upsert session_plans
      const spPayload = {
        user_id: uid,
        patient_id: patientId,
        session_id: targetSessionId,
        objetivo: planningValue.next_objetivo,
        retomar: planningValue.next_retomar,
        tecnicas: planningValue.next_tecnicas,
        observacoes: planningValue.next_observacoes,
        meta_id: planningValue.next_meta_id,
      };
      let existingId: string | null = sessionPlan.id ?? null;
      if (!existingId && targetSessionId) {
        const { data } = await supabase.from("session_plans").select("id").eq("session_id", targetSessionId).maybeSingle();
        existingId = data?.id ?? null;
      }
      const { error } = existingId
        ? await supabase.from("session_plans").update(spPayload).eq("id", existingId)
        : await supabase.from("session_plans").insert(spPayload);
      if (error) throw error;
      toast.success("Planejamento salvo");
      setPlanningOpen(false);
      await preserveScroll(() => loadAll());
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar planejamento");
    } finally {
      setPlanningSaving(false);
    }
  };

  // load patients
  useEffect(() => {
    if (!uid) return;
    supabase.from("patients").select("id, full_name, is_active, treatment_start_date, treatment_end_date").eq("user_id", uid).eq("is_active", true).order("full_name")
      .then(({ data }) => {
        const list = (data || []) as Patient[];
        setPatients(list);
        if (!patientId && queryPatient) setPatientId(queryPatient);
      });
  }, [uid, patientId, queryPatient]);

  useEffect(() => {
    if (queryPatient && queryPatient !== patientId) setPatientId(queryPatient);
  }, [queryPatient, patientId]);

  // sync query param when patientId changes
  useEffect(() => {
    if (patientId && patientId !== queryPatient) {
      setSearchParams({ patient: patientId }, { replace: true });
    }
  }, [patientId]);

  const loadAll = useCallback(async () => {
    if (!uid || !patientId) return;
    setLoading(true);
    try {
      const [p, g, t, r, ns] = await Promise.all([
        supabase.from("treatment_plans").select("*").eq("patient_id", patientId).maybeSingle(),
        supabase.from("treatment_goals").select("*").eq("patient_id", patientId).order("ordem"),
        supabase.from("treatment_techniques").select("*").eq("patient_id", patientId).order("created_at"),
        supabase.from("treatment_revisions").select("*").eq("patient_id", patientId).order("data", { ascending: false }),
        supabase.from("sessions").select("id, scheduled_at, duration_minutes").eq("patient_id", patientId).eq("user_id", uid)
          .gte("scheduled_at", new Date().toISOString()).not("status", "in", "(cancelled,no_show)").order("scheduled_at").limit(1).maybeSingle(),
      ]);
      if (p.data) setPlan({
        id: p.data.id, status: p.data.status, cid: p.data.cid || "",
        abordagem: p.data.abordagem || [], conceitualizacao: p.data.conceitualizacao || "",
      });
      else setPlan({ status: "ativo", cid: "", abordagem: [], conceitualizacao: "" });
      setGoals((g.data || []) as Goal[]);
      setTechniques((t.data || []) as Technique[]);
      setRevisions((r.data || []) as Revision[]);
      setNextSession(ns.data as NextSession | null);

      const { data: sessionsData } = await supabase.from("sessions")
        .select("id, scheduled_at, duration_minutes, status, notes")
        .eq("patient_id", patientId)
        .eq("user_id", uid)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true });
      setTreatmentSessions((sessionsData || []) as TreatmentSession[]);

      // load session_plan for next session
      if (ns.data?.id) {
        const { data: sp } = await supabase.from("session_plans").select("*").eq("session_id", ns.data.id).maybeSingle();
        if (sp) setSessionPlan({
          id: sp.id, session_id: sp.session_id, objetivo: sp.objetivo || "", meta_id: sp.meta_id,
          retomar: sp.retomar || "", tecnicas: sp.tecnicas || [], observacoes: sp.observacoes || "",
        });
        else setSessionPlan({ session_id: ns.data.id, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "" });
      } else {
        setSessionPlan({ session_id: null, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "" });
      }
    } finally {
      setLoading(false);
    }
  }, [uid, patientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load DSM-5-TR list + history scoped per patient.
  useEffect(() => {
    if (!patientId) { setDsm5List([]); setDsm5History([]); return; }
    try {
      // Prefer new multi key; fall back to legacy single key.
      const rawList = localStorage.getItem(`dsm5-list:${patientId}`);
      if (rawList) {
        const parsed = JSON.parse(rawList);
        setDsm5List(Array.isArray(parsed) ? parsed : []);
      } else {
        const rawSingle = localStorage.getItem(`dsm5:${patientId}`);
        const single = rawSingle ? JSON.parse(rawSingle) as DSM5Detail : null;
        setDsm5List(single?.diagnosis ? [single] : []);
      }
    } catch { setDsm5List([]); }
    try {
      const rawH = localStorage.getItem(`dsm5-history:${patientId}`);
      const parsed = rawH ? JSON.parse(rawH) : [];
      const items: DSM5HistoryItem[] = Array.isArray(parsed)
        ? parsed.map((v: any) => typeof v === "string"
            ? { diagnosis: v, severity: "", criteriaChecked: [], updatedAt: new Date().toISOString() }
            : v as DSM5HistoryItem)
        : [];
      setDsm5History(items);
    } catch { setDsm5History([]); }
  }, [patientId]);

  // Persist current list + keep plan.cid as joined diagnoses (comorbidades).
  useEffect(() => {
    if (!patientId) return;
    const valid = dsm5List.filter(d => d?.diagnosis);
    if (valid.length) localStorage.setItem(`dsm5-list:${patientId}`, JSON.stringify(valid));
    else localStorage.removeItem(`dsm5-list:${patientId}`);
    localStorage.removeItem(`dsm5:${patientId}`); // cleanup legacy
    const joined = valid.map(d => d.diagnosis).join(" + ");
    setPlan(p => (p.cid === joined ? p : { ...p, cid: joined }));
  }, [patientId, dsm5List]);

  // Auto-save every diagnosis into history.
  useEffect(() => {
    if (!patientId) return;
    const valid = dsm5List.filter(d => d?.diagnosis);
    if (!valid.length) return;
    setDsm5History(prev => {
      let next = [...prev];
      for (const d of valid) {
        const item: DSM5HistoryItem = {
          diagnosis: d.diagnosis,
          code: d.code,
          severity: d.severity,
          criteriaChecked: d.criteriaChecked,
          notes: d.notes,
          updatedAt: new Date().toISOString(),
        };
        next = [item, ...next.filter(h => h.diagnosis !== item.diagnosis)];
      }
      next = next.slice(0, 8);
      try { localStorage.setItem(`dsm5-history:${patientId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [
    patientId,
    JSON.stringify(dsm5List.map(d => ({ d: d.diagnosis, s: d.severity, n: d.notes, c: d.criteriaChecked?.join("|") }))),
  ]);





  /* ── save handlers ── */
  const ensurePlan = async () => {
    if (!uid || !patientId) return;
    if (plan.id) return;
    const { data } = await supabase
      .from("treatment_plans")
      .upsert(
        { user_id: uid, patient_id: patientId, status: plan.status || "ativo" },
        { onConflict: "patient_id" }
      )
      .select()
      .single();
    if (data) setPlan(p => ({ ...p, id: data.id, status: data.status }));
  };

  const savePlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    const payload = { user_id: uid, patient_id: patientId, status: plan.status, cid: plan.cid, abordagem: plan.abordagem, conceitualizacao: plan.conceitualizacao };
    const { error } = plan.id
      ? await supabase.from("treatment_plans").update(payload).eq("id", plan.id)
      : await supabase.from("treatment_plans").upsert(payload, { onConflict: "patient_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar plano"); else { toast.success("Plano salvo"); await preserveScroll(() => loadAll()); }
  };

  const saveSessionPlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    await ensurePlan();
    const payload = { ...sessionPlan, user_id: uid, patient_id: patientId };
    const { error } = sessionPlan.id
      ? await supabase.from("session_plans").update(payload).eq("id", sessionPlan.id)
      : await supabase.from("session_plans").insert(payload);
    setSaving(false);
    if (error) toast.error("Erro ao salvar"); else { toast.success("Próxima sessão salva"); await preserveScroll(() => loadAll()); }
  };

  const addGoal = async () => {
    if (!uid || !patientId) return;
    await ensurePlan();
    const { data, error } = await supabase.from("treatment_goals")
      .insert({ user_id: uid, patient_id: patientId, tipo: "geral", descricao: "", ordem: goals.length })
      .select().single();
    if (error) return toast.error("Erro");
    setGoals([...goals, data as Goal]);
  };
  const updateGoal = async (id: string, patch: Partial<Goal>) => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));
    await supabase.from("treatment_goals").update(patch).eq("id", id);
  };
  const removeGoal = async (id: string) => {
    setGoals(gs => gs.filter(g => g.id !== id));
    await supabase.from("treatment_goals").delete().eq("id", id);
  };

  const addTechnique = async () => {
    if (!newTech.trim() || !uid || !patientId) return;
    await ensurePlan();
    const { data, error } = await supabase.from("treatment_techniques")
      .insert({ user_id: uid, patient_id: patientId, nome: newTech.trim() }).select().single();
    if (error) return toast.error("Erro");
    setTechniques([...techniques, data as Technique]);
    setNewTech("");
  };
  const removeTechnique = async (id: string) => {
    setTechniques(ts => ts.filter(t => t.id !== id));
    await supabase.from("treatment_techniques").delete().eq("id", id);
  };

  const addRevision = async () => {
    if (!uid || !patientId) return;
    if (!newRevisionDesc.trim()) return toast.error("Descreva a revisão");
    await ensurePlan();
    const { data, error } = await supabase.from("treatment_revisions")
      .insert({ user_id: uid, patient_id: patientId, descricao: newRevisionDesc.trim(), sessao_ref: newRevisionRef.trim() }).select().single();
    if (error) return toast.error("Erro");
    setRevisions([data as Revision, ...revisions]);
    setNewRevisionDesc("");
    setNewRevisionRef("");
    setNewRevisionOpen(false);
    toast.success("Revisão registrada");
  };

  const toggleAbordagem = (v: string) => {
    setPlan(p => ({ ...p, abordagem: p.abordagem.includes(v) ? p.abordagem.filter(x => x !== v) : [...p.abordagem, v] }));
  };

  const toggleSessionTech = (nome: string) => {
    setSessionPlan(sp => ({ ...sp, tecnicas: sp.tecnicas.includes(nome) ? sp.tecnicas.filter(x => x !== nome) : [...sp.tecnicas, nome] }));
  };

  const exportPdf = () => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return toast.error("Selecione um paciente para exportar");

    const clean = (value?: string | null) => String(value || "").trim();
    const displayDate = (value?: string | null) => value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "—";
    const displayDateTime = (value: string) => format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const ensureSpace = (height = 12) => {
      if (y + height <= pageHeight - 18) return;
      doc.addPage();
      y = 18;
    };
    const text = (value: string | string[], x: number, yy: number, options?: Parameters<typeof doc.text>[3]) => doc.text(value, x, yy, options);
    const paragraph = (value: string, size = 10, color: [number, number, number] = [26, 16, 48]) => {
      const lines = doc.splitTextToSize(value || "—", contentWidth) as string[];
      ensureSpace(lines.length * 5 + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      text(lines, margin, y);
      y += lines.length * 5 + 3;
    };
    const section = (title: string) => {
      ensureSpace(16);
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(109, 79, 194);
      text(title, margin, y);
      y += 3;
      doc.setDrawColor(237, 233, 248);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;
    };
    const labelValue = (label: string, value: string, x: number, yy: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(106, 88, 128);
      text(label.toUpperCase(), x, yy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(26, 16, 48);
      text(value || "—", x, yy + 5);
    };

    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(1.2);
    doc.line(margin, y - 5, pageWidth - margin, y - 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(109, 79, 194);
    text("Plano de Tratamento", margin, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(106, 88, 128);
    text("Psi Real · Documento clínico", margin, y + 12);
    y += 20;

    doc.setFillColor(250, 248, 255);
    doc.setDrawColor(237, 233, 248);
    doc.roundedRect(margin, y, contentWidth, 34, 4, 4, "FD");
    const col = contentWidth / 2;
    labelValue("Paciente", patient.full_name, margin + 4, y + 8);
    labelValue("Status do plano", STATUS_OPTIONS.find(s => s.value === plan.status)?.label || plan.status, margin + col, y + 8);
    labelValue("Início do tratamento", displayDate(patient.treatment_start_date), margin + 4, y + 22);
    labelValue("Fim/alta", displayDate(patient.treatment_end_date), margin + col, y + 22);
    y += 42;

    section("Diagnóstico DSM-5-TR");
    const validDsm5 = dsm5List.filter(d => d?.diagnosis);
    if (!validDsm5.length) {
      paragraph("Diagnóstico: —");
    } else {
      validDsm5.forEach((d, idx) => {
        const role = idx === 0 ? "Principal" : `Comorbidade ${idx}`;
        paragraph(`${role}: ${clean(d.diagnosis)}`, 11);
        if (d.severity) paragraph(`Gravidade / especificador: ${d.severity}`, 9.5);
        const entry = getDsm5EntryByLabel(d.diagnosis);
        if (entry) {
          paragraph(`Critérios DSM-5-TR observados (${d.criteriaChecked.length}/${entry.criteria.length}):`, 9.5);
          entry.criteria.forEach(c => {
            const checked = d.criteriaChecked.includes(c);
            paragraph(`${checked ? "[X]" : "[ ]"} ${c}`, 9.5);
          });
          paragraph(`Diagnósticos diferenciais: ${entry.differentials.join(" · ")}`, 9.5);
          paragraph(`Esquemas e modos associados: ${entry.schemas.join(" · ")}`, 9.5);
        } else if (d.criteriaChecked.length) {
          paragraph(`Critérios observados (${d.criteriaChecked.length}):`, 9.5);
          d.criteriaChecked.forEach(c => paragraph(`• ${c}`, 9.5));
        }
        if (d.notes) {
          paragraph("Observações clínicas:", 9.5);
          paragraph(clean(d.notes), 9.5);
        }
      });
    }
    paragraph(`Abordagem: ${plan.abordagem.join(", ") || "—"}`);


    section("Metas terapêuticas");
    if (goals.length === 0) paragraph("Nenhuma meta cadastrada.", 10, [106, 88, 128]);
    goals.forEach((goal) => paragraph(`${GOAL_META[goal.tipo].label}: ${clean(goal.descricao) || "—"}`));

    section("Técnicas do plano");
    paragraph(techniques.map(t => t.nome).join(", ") || "—");

    if (nextSession) {
      section("Planejamento da próxima sessão");
      paragraph(`Data: ${displayDateTime(nextSession.scheduled_at)} · ${nextSession.duration_minutes} min`);
      paragraph(`Objetivo: ${clean(sessionPlan.objetivo) || "—"}`);
      paragraph(`Meta vinculada: ${clean(goals.find(g => g.id === sessionPlan.meta_id)?.descricao) || "—"}`);
      paragraph(`Retomar: ${clean(sessionPlan.retomar) || "—"}`);
      paragraph(`Técnicas: ${sessionPlan.tecnicas.join(", ") || "—"}`);
      paragraph(`Observações: ${clean(sessionPlan.observacoes) || "—"}`);
    }

    section("Sessões e datas");
    if (treatmentSessions.length === 0) paragraph("Nenhuma sessão registrada para este paciente.", 10, [106, 88, 128]);
    treatmentSessions.forEach((session, index) => {
      const row = `${index + 1}. ${displayDateTime(session.scheduled_at)} · ${session.duration_minutes} min · ${SESSION_STATUS_LABEL[session.status] || session.status}${session.notes ? ` · ${session.notes}` : ""}`;
      paragraph(row, 9.5);
    });

    section("Histórico de revisões");
    if (revisions.length === 0) paragraph("Nenhuma revisão registrada.", 10, [106, 88, 128]);
    revisions.forEach((revision) => paragraph(`${displayDate(revision.data)}${revision.sessao_ref ? ` · Sessão ${revision.sessao_ref}` : ""}\n${revision.descricao}`));

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(106, 88, 128);
      text(`Gerado em ${format(new Date(), "dd/MM/yyyy")} · Página ${i}/${pageCount}`, margin, pageHeight - 9);
    }

    const fileName = `plano-tratamento-${patient.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente"}.pdf`;
    doc.save(fileName);
    toast.success("PDF do plano de tratamento gerado.");
  };

  const goalsForSelect = useMemo(() => goals.filter(g => g.descricao.trim()), [goals]);

  if (!uid) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      <HelpCard
        id="plano-tratamento"
        title="Plano Terapêutico"
        description="O Plano Terapêutico reúne a estratégia clínica de longo prazo do paciente. Aqui você acompanha objetivos, metas, técnicas e revisões do tratamento."
        sections={[
          { label: "Quando usar", content: "Ao iniciar um caso, em sessões de revisão e sempre que precisar reorientar o tratamento." },
          { label: "Conexões", content: "O planejamento da próxima sessão é exibido apenas para consulta e é editado no Registro de Sessão. Formulações e humor complementam a leitura clínica." },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {patientId && (
            <Button variant="ghost" size="sm" onClick={() => { setPatientId(""); setSearchParams({}, { replace: true }); }}>
              <ArrowLeft className="h-4 w-4" /> Voltar à lista
            </Button>
          )}
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: `${PURPLE}15`, color: PURPLE }}>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Plano de tratamento</h1>
            <p className="text-sm text-muted-foreground">
              {patientId ? "Organize objetivos, técnicas e revisões do tratamento" : "Centro de organização clínica — selecione um paciente para abrir seu plano"}
            </p>
          </div>
        </div>

        <PageIntro description="Centraliza o plano terapêutico de cada paciente: objetivos, técnicas, revisões e indicadores de progresso. Use para guiar e documentar a evolução do tratamento — e para revisar com o paciente em sessões de fechamento." />

        {patientId && (
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
              <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={plan.status} onValueChange={v => setPlan(p => ({ ...p, status: v }))}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>

            <Button variant="ghost" className="w-full sm:w-auto" onClick={exportPdf} disabled={!patientId}>
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
            <Button variant="accent" className="w-full sm:w-auto" onClick={savePlan} disabled={!patientId || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar plano
            </Button>
          </div>
        )}
      </div>

      {!patientId ? (
        <PlanoTratamentoHub />
      ) : loading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : (
        <></>
      )}
      {patientId && !loading && (
        <>
          {/* Resumo rápido do plano */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "Status", value: STATUS_OPTIONS.find(s => s.value === plan.status)?.label || plan.status, color: PURPLE },
              { label: "Metas", value: String(goals.length), color: "hsl(var(--primary))" },
              { label: "Técnicas", value: String(techniques.length), color: "#BA7517" },
              { label: "Revisões", value: String(revisions.length), color: "hsl(var(--moss, 150 30% 30%))" },
              { label: "Sessões", value: String(treatmentSessions.length), color: PURPLE },
            ].map((s) => (
              <Card key={s.label} className="p-3 rounded-xl">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{s.label}</p>
                <p className="text-lg font-display font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* BLOCO 1 — Próxima sessão (somente leitura; edição no Registro de Sessão) */}
          <Card className="p-6 rounded-2xl border-l-4" style={{ borderLeftColor: PURPLE }}>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" style={{ color: PURPLE }} />
                <h2 className="font-display text-lg font-bold">Próxima sessão</h2>
              </div>
              <Button variant="accent" size="sm" onClick={openPlanningSheet}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar planejamento
              </Button>
            </div>

            {nextSession ? (
              <p className="text-sm text-muted-foreground mb-4">
                {format(new Date(nextSession.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} · {nextSession.duration_minutes} min
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Nenhuma sessão futura agendada para este paciente.</p>
            )}

            {(() => {
              const hasContent =
                (sessionPlan.objetivo && sessionPlan.objetivo.trim()) ||
                (sessionPlan.retomar && sessionPlan.retomar.trim()) ||
                (sessionPlan.observacoes && sessionPlan.observacoes.trim()) ||
                (sessionPlan.tecnicas && sessionPlan.tecnicas.length > 0) ||
                sessionPlan.meta_id;
              if (!hasContent) {
                return (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground bg-muted/30">
                    Nenhum planejamento registrado para a próxima sessão.
                    Use o botão <span className="font-medium">Editar planejamento</span> para começar
                    — o registro é feito diretamente pelo Registro de Sessão.
                  </div>
                );
              }
              const metaDescricao = sessionPlan.meta_id
                ? goalsForSelect.find((g) => g.id === sessionPlan.meta_id)?.descricao ?? null
                : null;
              return (
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  {sessionPlan.objetivo?.trim() && (
                    <div className="md:col-span-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Objetivo</div>
                      <div className="whitespace-pre-wrap">{sessionPlan.objetivo}</div>
                    </div>
                  )}
                  {metaDescricao && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Meta vinculada</div>
                      <div>{metaDescricao}</div>
                    </div>
                  )}
                  {sessionPlan.retomar?.trim() && (
                    <div className="md:col-span-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Retomar</div>
                      <div className="whitespace-pre-wrap">{sessionPlan.retomar}</div>
                    </div>
                  )}
                  {sessionPlan.tecnicas?.length > 0 && (
                    <div className="md:col-span-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Técnicas previstas</div>
                      <div className="flex flex-wrap gap-2">
                        {sessionPlan.tecnicas.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-secondary text-primary">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {sessionPlan.observacoes?.trim() && (
                    <div className="md:col-span-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Observações</div>
                      <div className="whitespace-pre-wrap">{sessionPlan.observacoes}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>


          {/* BLOCO 2 — Diagnóstico e Formulação */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Diagnóstico e formulação</h2>
            </div>
            <div className="space-y-5">
              <DSM5MultiDiagnostic
                values={dsm5List}
                onChange={setDsm5List}
                recent={dsm5History}
              />

              <div>
                <Label className="mb-2 block">Abordagem</Label>
                <div className="flex flex-wrap gap-3">
                  {ABORDAGEM_OPTIONS.map(a => (
                    <label key={a} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={plan.abordagem.includes(a)} onCheckedChange={() => toggleAbordagem(a)} />
                      <span className="text-sm">{a}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          </Card>

          {/* BLOCO 3 — Metas */}
          <Card className="p-6 rounded-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Metas terapêuticas</h2>
                <Badge variant="secondary" className="ml-1">{goals.length}</Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={addGoal}><Plus className="h-4 w-4" /> Adicionar meta</Button>
            </div>

            <div className="space-y-3">
              {goals.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Target className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Comece adicionando metas gerais, intermediárias e comportamentais.</p>
                </div>
              )}
              {goals.map(g => (
                <div key={g.id} className={cn("border-l-4 bg-card border border-border rounded-xl p-3 grid gap-3 sm:flex sm:items-start", GOAL_META[g.tipo].border)}>
                  <div className="flex flex-col gap-2 sm:w-[160px] shrink-0">
                    <span className={cn("inline-flex items-center justify-center text-[10px] uppercase tracking-wide font-bold rounded-full px-2 py-0.5", GOAL_META[g.tipo].chip)}>
                      {GOAL_META[g.tipo].label}
                    </span>
                    <Select value={g.tipo} onValueChange={(v) => updateGoal(g.id, { tipo: v as GoalType })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(GOAL_META) as GoalType[]).map(k => <SelectItem key={k} value={k}>{GOAL_META[k].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea value={g.descricao} onChange={e => updateGoal(g.id, { descricao: e.target.value })} rows={2} className="min-w-0 flex-1" placeholder="Descreva a meta..." />
                  <Button variant="ghost" size="icon" className="justify-self-end" onClick={() => removeGoal(g.id)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </Card>

          {/* BLOCO 4 — Técnicas */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Técnicas do plano</h2>
              <Badge variant="secondary" className="ml-1">{techniques.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {techniques.map(t => (
                <Badge key={t.id} variant="secondary" className="pl-3 pr-1 py-1 gap-1 text-sm">
                  {t.nome}
                  <button onClick={() => removeTechnique(t.id)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {techniques.length === 0 && <span className="text-sm text-muted-foreground">Adicione técnicas abaixo — elas ficam disponíveis para vincular em cada sessão.</span>}
            </div>
            <div className="grid gap-2 max-w-md sm:flex">
              <Input value={newTech} onChange={e => setNewTech(e.target.value)} placeholder="Ex: Reestruturação cognitiva"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTechnique())} />
              <Button variant="outline" className="w-full sm:w-auto" onClick={addTechnique}><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
          </Card>

          {/* BLOCO 5 — Revisões */}
          <Card className="p-6 rounded-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Histórico de revisões</h2>
                <Badge variant="secondary" className="ml-1">{revisions.length}</Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setNewRevisionOpen(o => !o)}>
                <Plus className="h-4 w-4" /> Nova revisão
              </Button>
            </div>

            {newRevisionOpen && (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div>
                  <Label>Descrição da revisão</Label>
                  <Textarea value={newRevisionDesc} onChange={e => setNewRevisionDesc(e.target.value)} rows={3}
                    placeholder="Ex: revisão das metas após 8 sessões; ajustes nas técnicas..." />
                </div>
                <div>
                  <Label>Referência da sessão (opcional)</Label>
                  <Input value={newRevisionRef} onChange={e => setNewRevisionRef(e.target.value)} placeholder="Ex: #8 ou 10/06/2026" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setNewRevisionOpen(false); setNewRevisionDesc(""); setNewRevisionRef(""); }}>Cancelar</Button>
                  <Button variant="accent" size="sm" onClick={addRevision}>Salvar revisão</Button>
                </div>
              </div>
            )}

            {revisions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <History className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Registre revisões periódicas para acompanhar a evolução do tratamento.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 border-l-2 border-border">
                {revisions.map(r => (
                  <div key={r.id} className="relative">
                    <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(new Date(r.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {r.sessao_ref && <span> · Sessão {r.sessao_ref}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      <Sheet open={planningOpen} onOpenChange={setPlanningOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Planejar próxima sessão</SheetTitle>
            <SheetDescription>
              Edite o planejamento sem sair do Plano Terapêutico. As alterações refletem no Registro de Sessão.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <SessionPlanningForm
              value={planningValue}
              onChange={(patch) => setPlanningValue((v) => ({ ...v, ...patch }))}
              planGoals={goalsForSelect}
              planTechniques={techniques}
            />
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setPlanningOpen(false)}>Cancelar</Button>
            <Button variant="accent" onClick={savePlanningFromSheet} disabled={planningSaving}>
              {planningSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar planejamento
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlanoTratamento;
