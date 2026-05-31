import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Loader2, Plus, X, FileDown, ClipboardList, Target, Sparkles, History, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";

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
  const queryPatient = searchParams.get("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>(queryPatient || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState<TreatmentPlan>({ status: "ativo", cid: "", abordagem: [], conceitualizacao: "" });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [newTech, setNewTech] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [treatmentSessions, setTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan>({
    session_id: null, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "",
  });

  // load patients
  useEffect(() => {
    if (!uid) return;
    supabase.from("patients").select("id, full_name, is_active, treatment_start_date, treatment_end_date").eq("user_id", uid).eq("is_active", true).order("full_name")
      .then(({ data }) => {
        const list = (data || []) as Patient[];
        setPatients(list);
        if (!patientId && list.length) setPatientId(queryPatient || list[0].id);
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

  /* ── save handlers ── */
  const savePlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    const payload = { user_id: uid, patient_id: patientId, status: plan.status, cid: plan.cid, abordagem: plan.abordagem, conceitualizacao: plan.conceitualizacao };
    const { error } = plan.id
      ? await supabase.from("treatment_plans").update(payload).eq("id", plan.id)
      : await supabase.from("treatment_plans").upsert(payload, { onConflict: "patient_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar plano"); else { toast.success("Plano salvo"); loadAll(); }
  };

  const saveSessionPlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    const payload = { ...sessionPlan, user_id: uid, patient_id: patientId };
    const { error } = sessionPlan.id
      ? await supabase.from("session_plans").update(payload).eq("id", sessionPlan.id)
      : await supabase.from("session_plans").insert(payload);
    setSaving(false);
    if (error) toast.error("Erro ao salvar"); else { toast.success("Próxima sessão salva"); loadAll(); }
  };

  const addGoal = async () => {
    if (!uid || !patientId) return;
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
    const desc = window.prompt("Descrição da revisão:");
    if (!desc?.trim()) return;
    const ref = window.prompt("Número/referência da sessão (opcional):") || "";
    const { data, error } = await supabase.from("treatment_revisions")
      .insert({ user_id: uid, patient_id: patientId, descricao: desc.trim(), sessao_ref: ref }).select().single();
    if (error) return toast.error("Erro");
    setRevisions([data as Revision, ...revisions]);
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

    section("Diagnóstico e formulação");
    paragraph(`CID: ${clean(plan.cid) || "—"}`);
    paragraph(`Abordagem: ${plan.abordagem.join(", ") || "—"}`);
    paragraph(clean(plan.conceitualizacao) || "—");

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
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: `${PURPLE}15`, color: PURPLE }}>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Plano de tratamento</h1>
            <p className="text-sm text-muted-foreground">Organize objetivos, técnicas e revisões do tratamento</p>
          </div>
        </div>

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
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : !patientId ? (
        <Card className="p-10 text-center text-muted-foreground">Cadastre um paciente para começar.</Card>
      ) : (
        <>
          {/* BLOCO 1 — Próxima sessão */}
          <Card className="p-6 rounded-2xl border-l-4" style={{ borderLeftColor: PURPLE }}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5" style={{ color: PURPLE }} />
              <h2 className="font-display text-lg font-bold">Próxima sessão</h2>
            </div>

            {nextSession ? (
              <p className="text-sm text-muted-foreground mb-4">
                {format(new Date(nextSession.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} · {nextSession.duration_minutes} min
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Nenhuma sessão futura agendada para este paciente.</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Objetivo da sessão</Label>
                <Textarea value={sessionPlan.objetivo} onChange={e => setSessionPlan(sp => ({ ...sp, objetivo: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>Meta vinculada</Label>
                <Select value={sessionPlan.meta_id || "none"} onValueChange={v => setSessionPlan(sp => ({ ...sp, meta_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma meta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhuma —</SelectItem>
                    {goalsForSelect.map(g => (
                      <SelectItem key={g.id} value={g.id}>[{GOAL_META[g.tipo].label}] {g.descricao.slice(0, 60)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>O que retomar da sessão anterior</Label>
                <Textarea value={sessionPlan.retomar} onChange={e => setSessionPlan(sp => ({ ...sp, retomar: e.target.value }))} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Técnicas a utilizar</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {techniques.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleSessionTech(t.nome)}
                      className={cn("px-3 py-1 rounded-full text-xs border transition-colors",
                        sessionPlan.tecnicas.includes(t.nome)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-primary border-primary/30 hover:bg-secondary")}>
                      {t.nome}
                    </button>
                  ))}
                  {techniques.length === 0 && <span className="text-xs text-muted-foreground">Adicione técnicas no bloco abaixo.</span>}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Observações / lembretes</Label>
                <Textarea value={sessionPlan.observacoes} onChange={e => setSessionPlan(sp => ({ ...sp, observacoes: e.target.value }))}
                  rows={2} placeholder="Ex: paciente mencionou situação com a mãe — retomar se trouxer..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="accent" size="sm" onClick={saveSessionPlan}>Salvar próxima sessão</Button>
            </div>
          </Card>

          {/* BLOCO 2 — Diagnóstico e Formulação */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Diagnóstico e formulação</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>CID-11</Label>
                  <Input value={plan.cid} onChange={e => setPlan(p => ({ ...p, cid: e.target.value }))} placeholder="Ex: 6B00 Transtorno de ansiedade generalizada" />
                </div>
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
              <div>
                <Label>Conceitualização resumida</Label>
                <Textarea value={plan.conceitualizacao} onChange={e => setPlan(p => ({ ...p, conceitualizacao: e.target.value }))} rows={8} />
              </div>
            </div>
          </Card>

          {/* BLOCO 3 — Metas */}
          <Card className="p-6 rounded-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Metas terapêuticas</h2>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={addGoal}><Plus className="h-4 w-4" /> Adicionar meta</Button>
            </div>

            <div className="space-y-3">
              {goals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>}
              {goals.map(g => (
                <div key={g.id} className={cn("border-l-4 bg-card border border-border rounded-xl p-3 grid gap-3 sm:flex sm:items-start", GOAL_META[g.tipo].border)}>
                  <Select value={g.tipo} onValueChange={(v) => updateGoal(g.id, { tipo: v as GoalType })}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GOAL_META) as GoalType[]).map(k => <SelectItem key={k} value={k}>{GOAL_META[k].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {techniques.map(t => (
                <Badge key={t.id} variant="secondary" className="pl-3 pr-1 py-1 gap-1 text-sm">
                  {t.nome}
                  <button onClick={() => removeTechnique(t.id)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {techniques.length === 0 && <span className="text-sm text-muted-foreground">Adicione técnicas abaixo.</span>}
            </div>
            <div className="grid gap-2 max-w-md sm:flex">
              <Input value={newTech} onChange={e => setNewTech(e.target.value)} placeholder="Ex: Reestruturação cognitiva"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTechnique())} />
              <Button variant="outline" className="w-full sm:w-auto" onClick={addTechnique}><Plus className="h-4 w-4" /></Button>
            </div>
          </Card>

          {/* BLOCO 5 — Revisões */}
          <Card className="p-6 rounded-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Histórico de revisões</h2>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={addRevision}><Plus className="h-4 w-4" /> Nova revisão</Button>
            </div>

            {revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda.</p>
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
    </div>
  );
};

export default PlanoTratamento;
