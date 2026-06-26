import { useEffect, useState, useCallback, useRef } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, User, Phone, Mail, Loader2, MoreHorizontal, Trash2, Pencil, Eye, ClipboardList, MessageCircle, Stethoscope, CalendarDays, Smile, FileText, Baby, Sparkles, Maximize2, Minimize2, X, Printer, BookOpen, RefreshCw, ChevronDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconPencil, IconUserOff, IconClipboardList, IconFileText, IconTarget, IconFlame, IconTrash } from "@tabler/icons-react";
import { AbordagemBadge } from "@/components/app/AbordagemBadge";
import { LogoIcon } from "@/components/LogoIcon";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TccRecords } from "@/components/app/TccRecords";
import { CaseFormulation } from "@/components/app/CaseFormulation";
import { ChildAnamnesisForm } from "@/components/app/ChildAnamnesisForm";
import { PatientSessionHistory } from "@/components/app/PatientSessionHistory";
import { PatientMoodChart } from "@/components/app/PatientMoodChart";
import { PatientSessionRecords } from "@/components/app/PatientSessionRecords";
import { CardSkeleton } from "@/components/app/Skeletons";
import { PatientHomework } from "@/components/app/PatientHomework";
import { IntegratedCaseSummary } from "@/components/app/IntegratedCaseSummary";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { PremiumGate } from "@/components/app/PremiumGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { UnsavedGuardDialog } from "@/components/app/UnsavedGuardDialog";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import { PageIntro } from "@/components/app/PageIntro";

const PATIENT_CATEGORIES = [
  { value: "adolescente", label: "Adolescente" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "casal", label: "Casal" },
  { value: "crianca", label: "Criança" },
  { value: "grupo", label: "Grupo" },
  { value: "individual", label: "Individual" },
  { value: "sessao_breve", label: "Sessão Breve" },
  { value: "supervisao", label: "Supervisão" },
] as const;

interface FormulationItem {
  key: string;
  label: string;
  filled: boolean;
  summary: string;
  fullSummary: string;
  accent: string;
  onView: () => void;
}

const FormulationItemCard = ({ item: it }: { item: FormulationItem }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = !!it.fullSummary && it.fullSummary.length > it.summary.length;
  const toggle = () => { if (hasMore) setExpanded((v) => !v); };
  return (
    <div className="rounded-xl p-3 flex items-start gap-3 min-w-0 w-full" style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))", borderLeft: `3px solid ${it.accent}` }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1 flex-wrap">
          <button
            type="button"
            onClick={toggle}
            className="min-w-0 text-left break-words flex items-center gap-1"
            style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: "hsl(var(--foreground))", cursor: hasMore ? "pointer" : "default" }}
            aria-expanded={expanded}
            aria-label={hasMore ? `${expanded ? "Recolher" : "Expandir"} ${it.label}` : it.label}
          >
            <span>{it.label}</span>
            {hasMore && (
              <ChevronDown
                className="h-3 w-3 shrink-0 transition-transform"
                style={{ transform: expanded ? "rotate(180deg)" : "none", color: "hsl(var(--muted-foreground))" }}
              />
            )}
          </button>
          <span className="shrink-0" style={{ background: it.filled ? "rgba(61,92,53,0.12)" : "rgba(0,0,0,0.06)", color: it.filled ? "hsl(var(--moss))" : "hsl(var(--muted-foreground))", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {it.filled ? "Preenchida" : "Pendente"}
          </span>
        </div>
        {it.summary ? (
          <button
            type="button"
            onClick={toggle}
            className="block w-full text-left break-words"
            style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "hsl(var(--brown))", lineHeight: 1.45, overflowWrap: "anywhere", cursor: hasMore ? "pointer" : "default" }}
            aria-expanded={expanded}
          >
            {expanded ? (it.fullSummary || it.summary) : it.summary}
          </button>
        ) : (
          <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>Ainda não preenchido.</p>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={toggle}
            className="mt-1 inline-flex items-center gap-1 hover:opacity-80"
            style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, fontWeight: 600, color: it.accent }}
          >
            {expanded ? "Mostrar menos" : "Mostrar mais"}
            <ChevronDown className="h-3 w-3 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
          </button>
        )}
      </div>
      <button
        onClick={it.onView}
        title="Visualizar"
        aria-label={`Visualizar ${it.label}`}
        className="shrink-0 flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ width: 32, height: 32, borderRadius: 8, background: it.accent, color: "#fff" }}
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
};


const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  phone_ddi: z.string().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  session_price: z.string().optional(),
  chief_complaint: z.string().trim().max(2000).optional().or(z.literal("")),
  treatment_plan: z.string().trim().max(4000).optional().or(z.literal("")),
  anamnesis: z.string().trim().max(6000).optional().or(z.literal("")),
  category: z.enum(["adolescente", "avaliacao", "casal", "crianca", "grupo", "individual", "sessao_breve", "supervisao"]).optional(),
  modality: z.enum(["presencial", "online"]).optional(),
});

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  session_price: number | null;
  shared_with_supervisor: boolean;
  chief_complaint: string | null;
  treatment_plan: string | null;
  anamnesis: string | null;
  category: "adolescente" | "avaliacao" | "casal" | "crianca" | "grupo" | "individual" | "sessao_breve" | "supervisao";
  modality: "presencial" | "online";
  has_financial_responsible: boolean;
  financial_responsible_name: string | null;
  financial_responsible_phone: string | null;
  treatment_start_date: string | null;
  treatment_end_date: string | null;
  has_psychiatrist: boolean;
  psychiatrist_name: string | null;
  psychiatrist_phone: string | null;
  medications: string | null;
  homework_token: string | null;
}

const FREE_PATIENT_LIMIT = 5;

const Patients = () => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [gateOpen, setGateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [formulFilter, setFormulFilter] = useState<"all" | "with" | "without">("all");
  const [tccPatient, setTccPatient] = useState<Patient | null>(null);
  const [padeksyPatient, setPadeksyPatient] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [moodPatient, setMoodPatient] = useState<Patient | null>(null);
  const [recordsPatient, setRecordsPatient] = useState<Patient | null>(null);
  const [anamnesisPatient, setAnamnesisPatient] = useState<Patient | null>(null);
  const [homeworkPatient, setHomeworkPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [pixKey, setPixKey] = useState<string>("");
  const [profName, setProfName] = useState<string>("");
  const [profCrp, setProfCrp] = useState<string>("");
  const patientGuard = useUnsavedGuard();
  const [latestSessionDates, setLatestSessionDates] = useState<Record<string, string>>({});
  const [anamneseFilled, setAnamneseFilled] = useState<Record<string, string>>({});
  const [formulationFilled, setFormulationFilled] = useState<Record<string, string>>({});
  const [teFilled, setTeFilled] = useState<Record<string, boolean>>({});
  const [actFilled, setActFilled] = useState<Record<string, boolean>>({});
  const [teData, setTeData] = useState<Record<string, { padrao_identificado?: string; foco_terapeutico?: string; conexao_gerada?: string; updated_at?: string }>>({});
  const [actData, setActData] = useState<Record<string, { apresentacao_problema?: string; direcionamento_gerado?: string; updated_at?: string }>>({});

  const [formulationSummaries, setFormulationSummaries] = useState<Record<string, string>>({});
  const [summaryMeta, setSummaryMeta] = useState<Record<string, { abordagem: string; label: string }>>({});
  const [formulationData, setFormulationData] = useState<Record<string, any>>({});
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});
  const [readPatient, setReadPatient] = useState<Patient | null>(null);
  const [summaryPatient, setSummaryPatient] = useState<Patient | null>(null);
  const [treatmentPlans, setTreatmentPlans] = useState<Record<string, { status: string; cid: string; abordagem: string[]; conceitualizacao: string; goals_count: number; techniques_count: number; revisions_count: number }>>({});
  const [counts, setCounts] = useState<{ mood: Record<string, number>; tcc: Record<string, number>; records: Record<string, number>; history: Record<string, number> }>({ mood: {}, tcc: {}, records: {}, history: {} });
  const [lastDates, setLastDates] = useState<{ mood: Record<string, string>; tcc: Record<string, string>; records: Record<string, string>; history: Record<string, string> }>({ mood: {}, tcc: {}, records: {}, history: {} });
  const [attendance, setAttendance] = useState<Record<string, { total: number; attended: number; pct: number }>>({});
  const [sessionInfo, setSessionInfo] = useState<Record<string, { lastDate?: string; lastStatus?: string; nextDate?: string; nextStatus?: string }>>({});
  const [fullscreen, setFullscreen] = useState<Record<string, boolean>>({});
  const toggleFull = (k: string) => setFullscreen((s) => ({ ...s, [k]: !s[k] }));
  const dlgCls = (k: string) => fullscreen[k]
    ? "max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] overflow-y-auto"
    : "w-[calc(100%-1rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto";
  const FullBtn = ({ k }: { k: string }) => (
    <Button type="button" variant="ghost" size="icon" className="absolute right-12 top-4 h-7 w-7" onClick={() => toggleFull(k)} title={fullscreen[k] ? "Reduzir" : "Abrir em página inteira"}>
      {fullscreen[k] ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );

  const DRAFT_KEY = "rascunho_novo_paciente";
  type FormState = { full_name: string; email: string; phone: string; phone_ddi: string; notes: string; session_price: string; chief_complaint: string; treatment_plan: string; anamnesis: string; category: "adolescente" | "avaliacao" | "casal" | "crianca" | "grupo" | "individual" | "sessao_breve" | "supervisao"; modality: "presencial" | "online"; has_financial_responsible: boolean; financial_responsible_name: string; financial_responsible_phone: string; financial_responsible_ddi: string; treatment_start_date: string; treatment_end_date: string; has_psychiatrist: boolean; psychiatrist_name: string; psychiatrist_phone: string; psychiatrist_phone_ddi: string; medications: string };
  const emptyForm: FormState = { full_name: "", email: "", phone: "", phone_ddi: "+55", notes: "", session_price: "", chief_complaint: "", treatment_plan: "", anamnesis: "", category: "individual", modality: "presencial", has_financial_responsible: false, financial_responsible_name: "", financial_responsible_phone: "", financial_responsible_ddi: "+55", treatment_start_date: "", treatment_end_date: "", has_psychiatrist: false, psychiatrist_name: "", psychiatrist_phone: "", psychiatrist_phone_ddi: "+55", medications: "" };
  const [form, setFormRaw] = useState<FormState>(emptyForm);
  const [draftRestored, setDraftRestored] = useState(false);
  const setForm = useCallback((v: typeof emptyForm | ((prev: typeof emptyForm) => typeof emptyForm)) => { patientGuard.markDirty(); setFormRaw(v); }, [patientGuard.markDirty]);

  // Auto-save draft to localStorage when form changes (only for new patient, not editing)
  useEffect(() => {
    if (!open || editing) return;
    // Only save if form has meaningful data
    if (form.full_name || form.email || form.phone || form.notes || form.chief_complaint) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
    }
  }, [form, open, editing]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftRestored(false);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [patientsRes, profileRes, sessionsRes, anamRes, moodRes, tccRes, recordsRes, historyRes, formRes, plansRes, goalsRes, techRes, revRes, teRes, actRes] = await Promise.all([
      supabase.from("patients").select("*").eq("user_id", user.id).order("full_name"),
      supabase.from("profiles").select("full_name, pix_key, crp").eq("id", user.id).maybeSingle(),
      supabase.from("sessions").select("patient_id, scheduled_at").eq("user_id", user.id).eq("payment_status", "pending").order("scheduled_at", { ascending: false }),
      supabase.from("child_anamneses").select("patient_id, updated_at").eq("user_id", user.id),
      supabase.from("patient_progress").select("patient_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tcc_records").select("patient_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("session_records").select("patient_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("sessions").select("patient_id, scheduled_at, status").eq("user_id", user.id).order("scheduled_at", { ascending: false }),
      supabase.from("case_formulations").select("patient_id, updated_at, ai_summary, environment, thoughts, emotions, behaviors, physical_reactions, core_beliefs, treatment_goals").eq("user_id", user.id),
      supabase.from("treatment_plans").select("patient_id, status, cid, abordagem, conceitualizacao").eq("user_id", user.id),
      supabase.from("treatment_goals").select("patient_id").eq("user_id", user.id),
      supabase.from("treatment_techniques").select("patient_id").eq("user_id", user.id),
      supabase.from("treatment_revisions").select("patient_id").eq("user_id", user.id),
      supabase.from("schema_formulations").select("patient_id, padrao_identificado, foco_terapeutico, conexao_gerada, updated_at").eq("therapist_id", user.id),
      supabase.from("act_formulations").select("patient_id, apresentacao_problema, direcionamento_gerado, updated_at").eq("therapist_id", user.id),

    ]);
    if (patientsRes.error) toast.error("Erro ao carregar pacientes");
    setPatients((patientsRes.data ?? []) as any);
    setPixKey((profileRes.data as any)?.pix_key ?? "");
    setProfName(profileRes.data?.full_name ?? "");
    setProfCrp((profileRes.data as any)?.crp ?? "");
    const dateMap: Record<string, string> = {};
    (sessionsRes.data ?? []).forEach((s: any) => {
      if (s.patient_id && !dateMap[s.patient_id]) dateMap[s.patient_id] = s.scheduled_at;
    });
    setLatestSessionDates(dateMap);
    const anamMap: Record<string, string> = {};
    (anamRes.data ?? []).forEach((a: any) => {
      if (a.patient_id) anamMap[a.patient_id] = a.updated_at;
    });
    setAnamneseFilled(anamMap);
    const formMap: Record<string, string> = {};
    const sumMap: Record<string, string> = {};
    const dataMap: Record<string, any> = {};
    (formRes.data ?? []).forEach((f: any) => {
      if (!f.patient_id) return;
      formMap[f.patient_id] = f.updated_at;
      if (f.ai_summary) sumMap[f.patient_id] = f.ai_summary;
      dataMap[f.patient_id] = f;
    });
    setFormulationFilled(formMap);
    setFormulationSummaries(sumMap);
    setFormulationData(dataMap);
    const teMap: Record<string, boolean> = {};
    const teDataMap: Record<string, any> = {};
    (teRes.data ?? []).forEach((r: any) => { if (r.patient_id) { teMap[r.patient_id] = true; teDataMap[r.patient_id] = r; } });
    setTeFilled(teMap);
    setTeData(teDataMap);
    const actMap: Record<string, boolean> = {};
    const actDataMap: Record<string, any> = {};
    (actRes.data ?? []).forEach((r: any) => { if (r.patient_id) { actMap[r.patient_id] = true; actDataMap[r.patient_id] = r; } });
    setActFilled(actMap);
    setActData(actDataMap);


    const plansMap: Record<string, any> = {};
    (plansRes.data ?? []).forEach((p: any) => {
      if (!p.patient_id) return;
      plansMap[p.patient_id] = {
        status: p.status || "",
        cid: p.cid || "",
        abordagem: p.abordagem || [],
        conceitualizacao: p.conceitualizacao || "",
        goals_count: 0,
        techniques_count: 0,
        revisions_count: 0,
      };
    });
    const bump = (rows: any[] | null, key: "goals_count" | "techniques_count" | "revisions_count") => {
      (rows ?? []).forEach((r: any) => {
        if (!r.patient_id) return;
        if (!plansMap[r.patient_id]) plansMap[r.patient_id] = { status: "", cid: "", abordagem: [], conceitualizacao: "", goals_count: 0, techniques_count: 0, revisions_count: 0 };
        plansMap[r.patient_id][key] += 1;
      });
    };
    bump(goalsRes.data, "goals_count");
    bump(techRes.data, "techniques_count");
    bump(revRes.data, "revisions_count");
    setTreatmentPlans(plansMap);
    const countAndLatest = (rows: any[] | null, dateKey: string) => {
      const c: Record<string, number> = {};
      const l: Record<string, string> = {};
      (rows ?? []).forEach((r: any) => {
        if (!r.patient_id) return;
        c[r.patient_id] = (c[r.patient_id] ?? 0) + 1;
        if (!l[r.patient_id] && r[dateKey]) l[r.patient_id] = r[dateKey];
      });
      return { c, l };
    };
    const m = countAndLatest(moodRes.data, "created_at");
    const t = countAndLatest(tccRes.data, "created_at");
    const r = countAndLatest(recordsRes.data, "created_at");
    const h = countAndLatest(historyRes.data, "scheduled_at");
    setCounts({ mood: m.c, tcc: t.c, records: r.c, history: h.c });
    setLastDates({ mood: m.l, tcc: t.l, records: r.l, history: h.l });
    // attendance: only consider past sessions
    const att: Record<string, { total: number; attended: number; pct: number }> = {};
    const nowTs = Date.now();
    (historyRes.data ?? []).forEach((s: any) => {
      if (!s.patient_id || !s.scheduled_at) return;
      if (new Date(s.scheduled_at).getTime() > nowTs) return;
      const cur = att[s.patient_id] ?? { total: 0, attended: 0, pct: 0 };
      cur.total += 1;
      if (s.status === "completed" || s.status === "done" || s.status === "attended") cur.attended += 1;
      att[s.patient_id] = cur;
    });
    Object.keys(att).forEach((k) => { att[k].pct = att[k].total > 0 ? Math.round((att[k].attended / att[k].total) * 100) : 0; });
    setAttendance(att);

    // last past / next future session per patient (historyRes is desc by scheduled_at)
    const info: Record<string, { lastDate?: string; lastStatus?: string; nextDate?: string; nextStatus?: string }> = {};
    (historyRes.data ?? []).forEach((s: any) => {
      if (!s.patient_id || !s.scheduled_at) return;
      const ts = new Date(s.scheduled_at).getTime();
      const cur = info[s.patient_id] ?? {};
      if (ts <= nowTs) {
        if (!cur.lastDate) { cur.lastDate = s.scheduled_at; cur.lastStatus = s.status; }
      } else {
        // upcoming: keep earliest future (list is desc, so last seen future = earliest)
        cur.nextDate = s.scheduled_at; cur.nextStatus = s.status;
      }
      info[s.patient_id] = cur;
    });
    setSessionInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  useAutoRefresh(() => { if (user) load(); }, { routePath: "/app/pacientes" });

  const summarizeFormulation = async (patientId: string) => {
    if (summarizing[patientId]) return;
    setSummarizing((s) => ({ ...s, [patientId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("summarize-formulation", { body: { patient_id: patientId } });
      if (error) throw error;
      const summary = (data as any)?.summary as string | undefined;
      if (summary) {
        setFormulationSummaries((m) => ({ ...m, [patientId]: summary }));
        setSummaryMeta((m) => ({ ...m, [patientId]: { abordagem: (data as any)?.abordagem, label: (data as any)?.abordagem_label } }));
        toast.success("Resumo de IA gerado");
      } else {
        toast.error((data as any)?.error || "Falha ao gerar resumo");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar resumo");
    } finally {
      setSummarizing((s) => ({ ...s, [patientId]: false }));
    }
  };

  const openNew = () => {
    if (!isPremium && patients.length >= FREE_PATIENT_LIMIT) {
      setGateOpen(true);
      return;
    }
    setEditing(null);
    // Try to restore draft from localStorage
    let restored = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as FormState;
        if (draft.full_name || draft.email || draft.phone || draft.notes || draft.chief_complaint) {
          setFormRaw(draft);
          restored = true;
          setDraftRestored(true);
        }
      }
    } catch {}
    if (!restored) {
      setFormRaw(emptyForm);
      setDraftRestored(false);
    }
    patientGuard.resetDirty();
    setOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    // Extract DDI from stored phone if it starts with +
    const rawPhone = p.phone ?? "";
    let ddi = "";
    let localPhone = rawPhone;
    const ddiMatch = rawPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (ddiMatch) {
      ddi = ddiMatch[1];
      localPhone = ddiMatch[2];
    }
    // Extract DDI from financial responsible phone
    const rawFrPhone = p.financial_responsible_phone ?? "";
    let frDdi = "";
    let frLocalPhone = rawFrPhone;
    const frDdiMatch = rawFrPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (frDdiMatch) {
      frDdi = frDdiMatch[1];
      frLocalPhone = frDdiMatch[2];
    }
    // Extract DDI from psychiatrist phone
    const rawPsyPhone = p.psychiatrist_phone ?? "";
    let psyDdi = "";
    let psyLocalPhone = rawPsyPhone;
    const psyDdiMatch = rawPsyPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (psyDdiMatch) {
      psyDdi = psyDdiMatch[1];
      psyLocalPhone = psyDdiMatch[2];
    }
    setForm({
      full_name: p.full_name,
      email: p.email ?? "",
      phone: localPhone,
      phone_ddi: ddi,
      notes: p.notes ?? "",
      session_price: p.session_price?.toString() ?? "",
      chief_complaint: p.chief_complaint ?? "",
      treatment_plan: p.treatment_plan ?? "",
      anamnesis: p.anamnesis ?? "",
      category: p.category ?? "individual",
      modality: (p.modality as any) ?? "presencial",
      has_financial_responsible: p.has_financial_responsible ?? false,
      financial_responsible_name: p.financial_responsible_name ?? "",
      financial_responsible_phone: frLocalPhone,
      financial_responsible_ddi: frDdi,
      treatment_start_date: p.treatment_start_date ?? "",
      treatment_end_date: p.treatment_end_date ?? "",
      has_psychiatrist: p.has_psychiatrist ?? false,
      psychiatrist_name: p.psychiatrist_name ?? "",
      psychiatrist_phone: psyLocalPhone,
      psychiatrist_phone_ddi: psyDdi,
      medications: p.medications ?? "",
    });
    patientGuard.resetDirty();
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone ? `${parsed.data.phone_ddi || "+55"} ${parsed.data.phone}`.trim() : null,
      notes: parsed.data.notes || null,
      session_price: parsed.data.session_price ? Number(parsed.data.session_price) : null,
      chief_complaint: parsed.data.chief_complaint || null,
      treatment_plan: parsed.data.treatment_plan || null,
      anamnesis: parsed.data.anamnesis || null,
      category: parsed.data.category || "individual",
      modality: parsed.data.modality || "presencial",
      has_financial_responsible: form.has_financial_responsible,
      financial_responsible_name: form.has_financial_responsible ? (form.financial_responsible_name || null) : null,
      financial_responsible_phone: form.has_financial_responsible && form.financial_responsible_phone
        ? `${form.financial_responsible_ddi || "+55"} ${form.financial_responsible_phone}`.trim()
        : null,
      treatment_start_date: form.treatment_start_date || null,
      treatment_end_date: form.treatment_end_date || null,
      has_psychiatrist: form.has_psychiatrist,
      psychiatrist_name: form.has_psychiatrist ? (form.psychiatrist_name || null) : null,
      psychiatrist_phone: form.has_psychiatrist && form.psychiatrist_phone
        ? `${form.psychiatrist_phone_ddi || "+55"} ${form.psychiatrist_phone}`.trim()
        : null,
      medications: form.medications || null,
    };

    const { error } = editing
      ? await supabase.from("patients").update(payload).eq("id", editing.id)
      : await supabase.from("patients").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar paciente");
      return;
    }
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
    if (!editing) clearDraft();
    patientGuard.resetDirty();
    keepScroll();
    setOpen(false);
    await preserveScroll(() => load());
  };

  const handleDelete = async (p: Patient) => {
    if (!confirm(`Excluir ${p.full_name}? As sessões vinculadas também serão removidas.`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Paciente excluído");
    await preserveScroll(() => load());
  };

  const toggleActive = async (p: Patient) => {
    const { error } = await supabase.from("patients").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar");
    await preserveScroll(() => load());
  };

  const toggleSharing = async (p: Patient) => {
    const { error } = await supabase
      .from("patients")
      .update({ shared_with_supervisor: !p.shared_with_supervisor } as any)
      .eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar compartilhamento");
    setPatients((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, shared_with_supervisor: !x.shared_with_supervisor } : x))
    );
  };

  const activeCount = patients.filter((p) => p.is_active).length;
  const inactiveCount = patients.length - activeCount;

  const buildWhatsAppUrl = (p: Patient) => {
    // Use financial responsible phone if available
    let digits: string;
    if (p.has_financial_responsible && p.financial_responsible_phone) {
      digits = p.financial_responsible_phone.replace(/\D/g, "");
    } else {
      digits = normalizePhoneForWhatsApp(p.phone);
    }
    if (!digits) return null;

    const recipientName = p.has_financial_responsible && p.financial_responsible_name
      ? p.financial_responsible_name.split(" ")[0]
      : p.full_name.split(" ")[0];
    const valor = p.session_price != null ? `R$ ${Number(p.session_price).toFixed(2).replace(".", ",")}` : "a combinar";
    const firstName = profName ? profName.split(" ")[0] : "";
    const message = [
      `Olá, ${recipientName}! Aqui é a sua psi, ${firstName || "sua psicóloga"}.`,
      "",
      latestSessionDates[p.id]
        ? `Passando para lembrar do acerto referente à nossa sessão de ${format(new Date(latestSessionDates[p.id]), "dd/MM/yyyy")}.`
        : `Passando para lembrar do acerto referente à sua sessão.`,
      "",
      `Valor: ${valor}`,
      pixKey ? `Chave Pix: ${pixKey}` : "",
      "",
      `Assim que realizar, pode me enviar o comprovante por aqui. Qualquer dúvida, fico à disposição!`,
      "",
      profName || "",
      profCrp ? `Psicóloga | CRP ${profCrp}` : "Psicóloga",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const filtered = patients
    .filter((p) => {
      // When filtering by formulation (with/without), always restrict to active patients
      if (formulFilter !== "all") return p.is_active;
      return statusFilter === "all" ? true : statusFilter === "active" ? p.is_active : !p.is_active;
    })
    .filter((p) =>
      formulFilter === "all" ? true : formulFilter === "with" ? !!formulationFilled[p.id] : !formulationFilled[p.id]
    )
    .filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase())
    );
  // Formulation counts consider only active patients (com/sem formulação só faz sentido entre ativos)
  const activePatients = patients.filter((p) => p.is_active);
  const withFormulCount = activePatients.filter((p) => !!formulationFilled[p.id]).length;
  const withoutFormulCount = activePatients.filter((p) => !formulationFilled[p.id]).length;
  const totalFormulCount = activePatients.length;

  // ───────── Insight strip computations ─────────
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const attentionPatients = activePatients.filter((p) => {
    const formDate = formulationFilled[p.id];
    if (!formDate) {
      const startMs = p.treatment_start_date ? new Date(p.treatment_start_date).getTime() : 0;
      return !p.treatment_start_date || nowMs - startMs > THIRTY_DAYS;
    }
    return nowMs - new Date(formDate).getTime() > THIRTY_DAYS;
  });
  const lowAdherencePatients = activePatients.filter((p) => {
    const a = attendance[p.id];
    return a && a.total >= 3 && a.pct < 50;
  });

  const todayLabel = format(new Date(), "EEEE',' d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const todayLabelCap = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  // ───────── Color palette (per spec) ─────────
  const C = {
    pageBg: "#F7F6F3",
    card: "#FFFFFF",
    ink: "#1A1A2E",
    muted: "#6B7280",
    border: "#E5E7EB",
    purple: "#534AB7",
    purpleSoft: "#EEEDFE",
    purpleInk: "#3C3489",
    gold: "#B8860B",
    goldSoft: "#FDF6E3",
    goldBorder: "#E8C97A",
    green: "#2D6A4F",
    greenSoft: "#EAF3DE",
    greenBorder: "#74C69D",
    red: "#C0392B",
    redSoft: "#FDECEA",
    neutralBg: "#F9FAFB",
    avatarA: "#EEEDFE",
    avatarB: "#FDF6E3",
    avatarC: "#EAF3DE",
  };
  const avatarPalette = [C.avatarA, C.avatarB, C.avatarC];

  return (
    <div
      className="animate-fade-up -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 px-3 sm:px-6 pt-4 sm:pt-6 pb-10 min-h-screen"
      style={{ background: C.pageBg, fontFamily: "Inter, sans-serif", color: C.ink }}
    >
      {/* ─────────── TOPBAR ─────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clínica</p>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Pacientes</h1>
            <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-2xl">{todayLabelCap}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente..."
              className="pl-9 w-[220px] rounded-full"
            />
          </div>
          <Button onClick={openNew} variant="accent" className="rounded-full font-display font-semibold">
            <Plus className="h-4 w-4" /> Novo paciente
          </Button>
        </div>
      </header>

      <PageIntro description="Cadastro central dos seus pacientes. Daqui você abre a ficha, registra sessões, organiza formulações de caso, acompanha humor e exporta dados clínicos." />




      {/* ─────────── INSIGHT STRIP ─────────── */}
      {(attentionPatients.length > 0 || lowAdherencePatients.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {attentionPatients.length > 0 && (
            <div style={{ background: C.goldSoft, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(184,134,11,0.18)", color: C.gold, fontWeight: 700, fontSize: 13 }}>!</div>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.08em" }}>Atenção Clínica</p>
                  <p className="mt-0.5" style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                    {attentionPatients.length} {attentionPatients.length === 1 ? "paciente sem formulação" : "pacientes sem formulação"} há mais de 30 dias.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {attentionPatients.slice(0, 3).map((p) => (
                      <span key={p.id} style={{ background: "rgba(184,134,11,0.14)", color: C.gold, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 40 }}>
                        {p.full_name.split(" ").slice(0, 2).join(" ")}
                      </span>
                    ))}
                    {attentionPatients.length > 3 && (
                      <span style={{ background: "rgba(184,134,11,0.14)", color: C.gold, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 40 }}>+ {attentionPatients.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {lowAdherencePatients.length > 0 && (
            <div style={{ background: C.purpleSoft, borderLeft: `3px solid ${C.purple}`, borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(83,74,183,0.18)", color: C.purple }}>
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: "0.08em" }}>Baixa Adesão</p>
                  <p className="mt-0.5" style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                    {lowAdherencePatients.length} {lowAdherencePatients.length === 1 ? "paciente com menos" : "pacientes com menos"} de 50% de comparecimento este mês.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {lowAdherencePatients.slice(0, 3).map((p) => (
                      <span key={p.id} style={{ background: "rgba(83,74,183,0.14)", color: C.purple, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 40 }}>
                        {p.full_name.split(" ").slice(0, 2).join(" ")}
                      </span>
                    ))}
                    {lowAdherencePatients.length > 3 && (
                      <span style={{ background: "rgba(83,74,183,0.14)", color: C.purple, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 40 }}>+ {lowAdherencePatients.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────── FILTER TABS ─────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex items-center gap-1 p-1" style={{ background: C.neutralBg, borderRadius: 10, border: `1px solid ${C.border}` }}>
          {[
            { k: "active", label: "Ativos", n: activeCount },
            { k: "inactive", label: "Inativos", n: inactiveCount },
            { k: "all", label: "Todos", n: patients.length },
          ].map((t) => {
            const isActive = statusFilter === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setStatusFilter(t.k as typeof statusFilter)}
                style={{
                  background: isActive ? C.card : "transparent",
                  border: isActive ? `1px solid ${C.border}` : "1px solid transparent",
                  color: isActive ? C.ink : C.muted,
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 7,
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t.label}
                <span style={{ background: isActive ? C.purpleSoft : C.border, color: isActive ? C.purple : C.muted, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 40 }}>{t.n}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {[
            { k: "with" as const, label: "Com formulação", n: withFormulCount, highlight: false },
            { k: "without" as const, label: "Sem formulação", n: withoutFormulCount, highlight: true },
          ].map((t) => {
            const isActive = formulFilter === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setFormulFilter(isActive ? "all" : t.k)}
                style={{
                  background: t.highlight ? C.goldSoft : (isActive ? C.purpleSoft : C.card),
                  border: `1px solid ${t.highlight ? C.goldBorder : C.border}`,
                  color: t.highlight ? C.gold : (isActive ? C.purple : C.muted),
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                {t.label} · {t.n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────── PATIENT LIST ─────────── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 56, textAlign: "center" }}>
          <User className="h-12 w-12 mx-auto" style={{ color: C.muted }} />
          <p className="mt-4" style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>
            {patients.length === 0 ? "Pronto para começar?" : "Nenhum resultado encontrado."}
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: C.muted }}>
            {patients.length === 0 ? "Cadastre seu primeiro paciente e organize seu consultório." : "Tente outra busca ou limpe o filtro."}
          </p>
          {patients.length === 0 && (
            <button onClick={openNew} className="inline-flex items-center gap-1.5 mt-5" style={{ background: C.ink, color: "#fff", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13 }}>
              <Plus className="h-4 w-4" /> Cadastrar primeiro paciente
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p, idx) => {
            const isCriticalAlert = p.notes ? /(crise|resist|abandon|suic|término)/i.test(p.notes) : false;
            const isAttention = attentionPatients.some((x) => x.id === p.id);
            const isLowAdherence = lowAdherencePatients.some((x) => x.id === p.id);
            const borderColor = isCriticalAlert ? C.red : isAttention ? C.gold : C.purple;
            const cHist = counts.history[p.id] || 0;
            const cMood = counts.mood[p.id] || 0;
            const cTcc = counts.tcc[p.id] || 0;
            const hasAnam = !!anamneseFilled[p.id];
            const hasFormul = !!formulationFilled[p.id];
            const aiSum = formulationSummaries[p.id];
            const tp = treatmentPlans[p.id];
            const planMetasCount = tp?.goals_count || 0;
            const hasPlan = !!(tp && (planMetasCount > 0 || tp.conceitualizacao?.trim() || tp.techniques_count > 0));
            const type = PATIENT_CATEGORIES.find((c) => c.value === p.category)?.label ?? "Individual";
            const isSupervision = p.category === "supervisao";
            const initials = p.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            const avatarBg = avatarPalette[idx % avatarPalette.length];
            const url = buildWhatsAppUrl(p);
            const att = attendance[p.id];

            const Pill = ({ label, kind, count }: { label: string; kind: "filled" | "pending" | "neutral"; count?: number }) => {
              const styles = kind === "filled"
                ? { background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` }
                : kind === "pending"
                ? { background: C.goldSoft, color: C.gold, border: `1px solid ${C.goldBorder}` }
                : { background: C.neutralBg, color: C.muted, border: `1px solid ${C.border}` };
              return (
                <span className="inline-flex items-center gap-1" style={{ ...styles, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6 }}>
                  {label}
                  {count != null && count > 0 && (
                    <span style={{ background: kind === "filled" ? C.green : "rgba(0,0,0,0.08)", color: kind === "filled" ? "#fff" : "inherit", borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{count}</span>
                  )}
                </span>
              );
            };

            return (
              <li
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className="cursor-pointer transition-shadow overflow-hidden"
                style={{ background: C.card, borderRadius: 10, borderLeft: `3px solid ${borderColor}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
              >
                <div className="flex flex-wrap items-center gap-4 px-4 sm:px-5 py-4">
                  <div className="shrink-0 flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: "50%", background: avatarBg, color: C.ink, fontWeight: 700, fontSize: 13 }}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{p.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span style={{ background: C.greenSoft, color: C.green, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </span>
                      {isSupervision ? (
                        <span style={{ background: C.goldSoft, color: C.gold, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>Supervisão</span>
                      ) : (
                        <span style={{ background: "#F3F4F6", color: C.muted, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{type}</span>
                      )}
                      {p.phone && (
                        <span className="inline-flex items-center gap-1" style={{ fontSize: 12, color: C.muted }}>
                          <Phone className="h-3 w-3" />
                          <span className="truncate max-w-[140px]">{p.phone}</span>
                        </span>
                      )}
                    </div>
                    {(() => {
                      const si = sessionInfo[p.id];
                      const lastRec = lastDates.records[p.id];
                      const lastFormU = formulationFilled[p.id];
                      const statusLabel: Record<string, string> = {
                        scheduled: "Agendada", confirmed: "Confirmada", completed: "Realizada",
                        done: "Realizada", attended: "Realizada", cancelled: "Cancelada", no_show: "Faltou",
                      };
                      const statusColor: Record<string, string> = {
                        scheduled: C.purple, confirmed: C.green, completed: C.green,
                        done: C.green, attended: C.green, cancelled: C.red, no_show: C.gold,
                      };
                      const hasAny = si?.lastDate || si?.nextDate || lastRec || lastFormU;
                      if (!hasAny) return null;
                      const Item = ({ icon, label, value, color }: any) => (
                        <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: C.muted }}>
                          {icon}
                          <span>{label}:</span>
                          <strong style={{ color: color || C.ink, fontWeight: 600 }}>{value}</strong>
                        </span>
                      );
                      return (
                        <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 flex-wrap">
                          {si?.lastDate && (
                            <Item
                              icon={<CalendarDays className="h-3 w-3" />}
                              label="Última sessão"
                              value={`${format(new Date(si.lastDate), "dd/MM/yyyy", { locale: ptBR })}${si.lastStatus ? ` · ${statusLabel[si.lastStatus] || si.lastStatus}` : ""}`}
                              color={si.lastStatus ? statusColor[si.lastStatus] : undefined}
                            />
                          )}
                          {si?.nextDate && (
                            <Item
                              icon={<CalendarDays className="h-3 w-3" />}
                              label="Próxima"
                              value={`${format(new Date(si.nextDate), "dd/MM/yyyy", { locale: ptBR })}${si.nextStatus ? ` · ${statusLabel[si.nextStatus] || si.nextStatus}` : ""}`}
                              color={si.nextStatus ? statusColor[si.nextStatus] : undefined}
                            />
                          )}
                          {lastRec && (
                            <Item
                              icon={<FileText className="h-3 w-3" />}
                              label="Último registro"
                              value={format(new Date(lastRec), "dd/MM/yyyy", { locale: ptBR })}
                            />
                          )}
                          {lastFormU && (
                            <Item
                              icon={<Sparkles className="h-3 w-3" />}
                              label="Formulação atualizada"
                              value={format(new Date(lastFormU), "dd/MM/yyyy", { locale: ptBR })}
                            />
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/agenda?patient=${p.id}`); }}
                            className="inline-flex items-center gap-1"
                            style={{ fontSize: 11, fontWeight: 600, color: C.purple, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                            title="Ver na agenda"
                          >
                            <CalendarDays className="h-3 w-3" /> Ver agenda
                          </button>
                        </div>
                      );
                    })()}
                  </div>


                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    {p.session_price != null && (
                      <div className="text-right hidden sm:block">
                        <span style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>R$ {Number(p.session_price).toFixed(0)}</span>
                        <span style={{ fontSize: 12, color: C.muted, marginLeft: 2 }}>/sessão</span>
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center"
                          style={{ width: 32, height: 32, borderRadius: 7, background: C.card, border: `1px solid ${C.border}`, color: C.muted }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openEdit(p)}><IconPencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(p)}><IconUserOff className="h-4 w-4 mr-2" /> {p.is_active ? "Marcar inativo" : "Reativar"}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTccPatient(p)}><IconClipboardList className="h-4 w-4 mr-2" /> Registros TCC</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPadeksyPatient(p)}><IconFileText className="h-4 w-4 mr-2" /> Formulação de caso TCC</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/app/pacientes/${p.id}/formulacao-te`)} className="text-[#B8860B] hover:bg-[#FDF6E3] focus:bg-[#FDF6E3]"><IconTarget className="h-4 w-4 mr-2" /> Formulação TE</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/app/pacientes/${p.id}/formulacao-act`)} className="text-[#2D6A4F] hover:bg-[#EAF3DE] focus:bg-[#EAF3DE]"><IconFlame className="h-4 w-4 mr-2" /> Formulação ACT</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setRecordsPatient(p)}><FileText className="h-4 w-4 mr-2" /> Registros de sessão</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHomeworkPatient(p)}><ClipboardList className="h-4 w-4 mr-2" /> Tarefas de casa</DropdownMenuItem>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => handleDelete(p)} className="text-[#C0392B]"><IconTrash className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>

                {/* Resumo do cadastro e Resumo IA movidos para a visualização expandida (sheet) */}

                {isCriticalAlert && (
                  <div style={{ background: C.redSoft, borderTop: `1px solid ${C.border}`, padding: "9px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>!</span>
                    <p style={{ color: C.red, fontWeight: 500, fontSize: 12 }}>
                      Sinais de alerta nas notas — considerar revisar plano clínico na próxima sessão.
                    </p>
                  </div>
                )}
                {!isCriticalAlert && isAttention && !hasFormul && (
                  <div style={{ background: C.goldSoft, borderTop: `1px solid ${C.border}`, padding: "9px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>!</span>
                    <p style={{ color: C.gold, fontWeight: 500, fontSize: 12 }}>
                      Sem formulação há mais de 30 dias — considerar iniciar RPD na próxima sessão.
                    </p>
                  </div>
                )}
                {!isCriticalAlert && isLowAdherence && att && (
                  <div style={{ background: C.purpleSoft, borderTop: `1px solid ${C.border}`, padding: "9px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles className="h-3 w-3" style={{ color: C.purple }} />
                    <p style={{ color: C.purple, fontWeight: 500, fontSize: 12 }}>
                      Comparecimento em {att.pct}% — considerar conversar sobre vínculo terapêutico.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}


      {/* Side panel */}
      <Sheet open={!!selectedPatient} onOpenChange={(o) => !o && setSelectedPatient(null)}>
        <SheetContent side="right" className="w-full sm:max-w-full p-0" style={{ background: "hsl(var(--card))", borderLeft: "0.5px solid hsl(var(--border))" }}>
          {selectedPatient && (() => {
            const p = selectedPatient;
            const cHist = counts.history[p.id] || 0;
            const cRec = counts.records[p.id] || 0;
            const cMood = counts.mood[p.id] || 0;
            const cTcc = counts.tcc[p.id] || 0;
            const hasAnam = !!anamneseFilled[p.id];
            const url = buildWhatsAppUrl(p);
            const type = PATIENT_CATEGORIES.find(c => c.value === p.category)?.label ?? "Individual";
            const Chip = ({ label, count, onClick }: { label: string; count?: number; onClick: () => void }) => (
              <button
                onClick={onClick}
                className="inline-flex items-center gap-1.5 transition-colors uppercase"
                style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))", color: "hsl(var(--primary-dark))", padding: "5px 10px", borderRadius: 40, fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.04em" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--border))"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "hsl(var(--background))"; }}
              >
                {label}
                {count != null && count > 0 && (
                  <span style={{ background: "rgba(150,117,206,0.15)", borderRadius: 40, padding: "0 6px", fontSize: 9 }}>{count}</span>
                )}
              </button>
            );
            return (
              <div className="h-full overflow-y-auto relative">
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold)), hsl(var(--gold)))" }} />
                <div className="absolute right-4 top-4 flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center justify-center transition-colors"
                        style={{ width: 28, height: 28, borderRadius: 6, color: "hsl(var(--muted-foreground))" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--background))"; e.currentTarget.style.color = "hsl(var(--primary))"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); openEdit(p); }}><IconPencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); toggleActive(p); }}><IconUserOff className="h-4 w-4 mr-2" /> {p.is_active ? "Marcar inativo" : "Reativar"}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); setTccPatient(p); }}><IconClipboardList className="h-4 w-4 mr-2" /> Registros TCC</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); setPadeksyPatient(p); }}><IconFileText className="h-4 w-4 mr-2" /> Formulação de caso TCC</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); navigate(`/app/pacientes/${p.id}/formulacao-te`); }} className="text-[#B8860B] hover:bg-[#FDF6E3] focus:bg-[#FDF6E3]"><IconTarget className="h-4 w-4 mr-2" /> Formulação TE</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); navigate(`/app/pacientes/${p.id}/formulacao-act`); }} className="text-[#2D6A4F] hover:bg-[#EAF3DE] focus:bg-[#EAF3DE]"><IconFlame className="h-4 w-4 mr-2" /> Formulação ACT</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); setRecordsPatient(p); }}><FileText className="h-4 w-4 mr-2" /> Registros de sessão</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); setHomeworkPatient(p); }}><ClipboardList className="h-4 w-4 mr-2" /> Tarefas de casa</DropdownMenuItem>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => { setSelectedPatient(null); handleDelete(p); }} className="text-[#C0392B]"><IconTrash className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="flex items-center justify-center transition-colors"
                    style={{ width: 28, height: 28, borderRadius: 6, color: "hsl(var(--muted-foreground))" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--background))"; e.currentTarget.style.color = "hsl(var(--primary))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-w-3xl mx-auto">
                  <div
                    className="sticky top-0 z-20 px-4 sm:px-6 pt-10 pb-4"
                    style={{ background: "hsl(var(--card))", borderBottom: "0.5px solid hsl(var(--border))" }}
                  >
                    <div className="flex items-center gap-3 pr-16 sm:pr-20">
                      <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: "rgba(150,117,206,0.08)", color: "hsl(var(--primary))", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16 }}>
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))" }}>{p.full_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="uppercase" style={{ background: "rgba(201,168,76,0.10)", border: "0.5px solid rgba(201,168,76,0.3)", color: "hsl(var(--brown))", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 9, borderRadius: 40, padding: "3px 8px", letterSpacing: "0.04em" }}>{type}</span>
                          {p.is_active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(var(--moss))" }} />}
                          {p.phone && <span className="inline-flex items-center gap-1 min-w-0 max-w-full" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "hsl(var(--muted-foreground))" }}><Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{p.phone}</span></span>}
                          {p.session_price != null && <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "hsl(var(--brown))", fontWeight: 600 }}>R$ {Number(p.session_price).toFixed(2).replace(".", ",")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 sm:px-6 pt-4 pb-6 min-w-0">

                  <div className="space-y-2" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13, color: "hsl(var(--brown))" }}>
                    {p.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} /> {p.email}</p>}
                  </div>

                  <div className="mt-6">
                    <p className="uppercase mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))" }}>Resumo clínico</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip label="Humor" count={cMood} onClick={() => { setSelectedPatient(null); setMoodPatient(p); }} />
                      <Chip label="Histórico" count={cHist} onClick={() => { setSelectedPatient(null); setHistoryPatient(p); }} />
                      <Chip label="Sessões" count={cRec} onClick={() => { setSelectedPatient(null); setRecordsPatient(p); }} />
                      <Chip label="Anamnese" count={hasAnam ? 1 : 0} onClick={() => { setSelectedPatient(null); setAnamnesisPatient(p); }} />
                      <Chip label="Plano" onClick={() => { setSelectedPatient(null); navigate(`/app/plano-tratamento?patient=${p.id}`); }} />
                      <Chip label="Tarefas de casa" onClick={() => { setSelectedPatient(null); setHomeworkPatient(p); }} />
                    </div>
                  </div>

                  {(() => {
                    const trunc = (t?: string, n = 180) => !t ? "" : (t.length > n ? t.slice(0, n).trimEnd() + "…" : t);
                    const tccSummary = formulationSummaries[p.id] || formulationData[p.id]?.treatment_goals || formulationData[p.id]?.core_beliefs || "";
                    const te = teData[p.id];
                    const teSummary = te?.foco_terapeutico || te?.padrao_identificado || te?.conexao_gerada || "";
                    const act = actData[p.id];
                    const actSummary = act?.direcionamento_gerado || act?.apresentacao_problema || "";
                    const items = [
                      {
                        key: "tcc",
                        label: "TCC — Formulação de caso",
                        filled: !!formulationFilled[p.id],
                        summary: trunc(tccSummary),
                        fullSummary: tccSummary,
                        accent: "hsl(var(--primary))",
                        onView: () => { setSelectedPatient(null); setPadeksyPatient(p); },
                      },
                      {
                        key: "te",
                        label: "TE — Terapia do Esquema",
                        filled: !!teFilled[p.id],
                        summary: trunc(teSummary),
                        fullSummary: teSummary,
                        accent: "#B8860B",
                        onView: () => { setSelectedPatient(null); navigate(`/app/pacientes/${p.id}/formulacao-te`); },
                      },
                      {
                        key: "act",
                        label: "ACT — Terapia de Aceitação",
                        filled: !!actFilled[p.id],
                        summary: trunc(actSummary),
                        fullSummary: actSummary,
                        accent: "#2D6A4F",
                        onView: () => { setSelectedPatient(null); navigate(`/app/pacientes/${p.id}/formulacao-act`); },
                      },
                      {
                        key: "rpd",
                        label: "RPD — Registros TCC",
                        filled: cTcc > 0,
                        summary: cTcc > 0 ? `${cTcc} ${cTcc === 1 ? "registro" : "registros"} preenchido${cTcc === 1 ? "" : "s"}` : "",
                        fullSummary: cTcc > 0 ? `${cTcc} ${cTcc === 1 ? "registro" : "registros"} preenchido${cTcc === 1 ? "" : "s"}` : "",
                        accent: "hsl(var(--moss))",
                        onView: () => { setSelectedPatient(null); setTccPatient(p); },
                      },
                    ];
                    return (
                      <div className="mt-6">
                        <p className="uppercase mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))" }}>Formulações</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {items.map((it) => (
                            <FormulationItemCard key={it.key} item={it} />
                          ))}
                        </div>


                      </div>
                    );
                  })()}

                  <IntegratedCaseSummary patientId={p.id} />





                  <div className="mt-6 space-y-2">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full"
                        style={{ background: "rgba(150,117,206,0.08)", color: "hsl(var(--primary))", border: "0.5px solid rgba(150,117,206,0.25)", borderRadius: 40, padding: "10px 16px", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 12 }}
                      >
                        <MessageCircle className="h-4 w-4" /> Cobrar via WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => { setSelectedPatient(null); navigate("/app/agenda"); }}
                      className="flex items-center justify-center gap-2 w-full"
                      style={{ background: "hsl(var(--primary))", color: "#fff", borderRadius: 40, padding: "10px 16px", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 12 }}
                    >
                      <CalendarDays className="h-4 w-4" /> Nova sessão
                    </button>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/anamnese-crianca/${p.id}`;
                        const phone = (p.phone || "").replace(/\D/g, "");
                        const msg = `Olá! Para iniciarmos o atendimento de ${p.full_name}, por favor preencha a anamnese neste link: ${link}`;
                        if (phone) {
                          window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                        } else {
                          navigator.clipboard.writeText(link);
                          toast.success("Link da anamnese copiado!");
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full"
                      style={{ background: "rgba(29,158,117,0.10)", color: "hsl(var(--moss))", border: "0.5px solid rgba(29,158,117,0.3)", borderRadius: 40, padding: "10px 16px", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 12 }}
                    >
                      <Baby className="h-4 w-4" /> Enviar anamnese
                    </button>
                    <button
                      onClick={() => window.open(`https://wa.me/5511947388423?text=${encodeURIComponent(`Olá Michelle, preciso de supervisão para o caso do(a) paciente: ${p.full_name}`)}`, "_blank")}
                      className="flex items-center justify-center gap-2 w-full"
                      style={{ background: "rgba(201,168,76,0.10)", color: "hsl(var(--brown))", border: "0.5px solid rgba(201,168,76,0.3)", borderRadius: 40, padding: "10px 16px", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 12 }}
                    >
                      <Stethoscope className="h-4 w-4" /> Pedir supervisão
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4" style={{ borderTop: "0.5px solid hsl(var(--border))" }}>
                    <div className="flex items-center gap-2" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                      <Eye className="h-3.5 w-3.5" /> Visível ao supervisor
                    </div>
                    <Switch checked={p.shared_with_supervisor} onCheckedChange={() => toggleSharing(p)} />
                  </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* New/Edit patient dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { patientGuard.guardClose(() => { if (!editing) clearDraft(); setOpen(false); }, () => setOpen(false)); } else { setOpen(true); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto [&_input]:scroll-mt-24 [&_textarea]:scroll-mt-24">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
            <DialogDescription>Cadastre as informações do paciente.</DialogDescription>
          </DialogHeader>
          {draftRestored && !editing && (
            <div className="rounded-lg bg-accent/20 border border-accent/30 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2">
              <span>📝 Rascunho recuperado. Continue de onde parou.</span>
              <Button type="button" variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={() => { clearDraft(); setFormRaw(emptyForm); }}>Descartar</Button>
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {PATIENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modality">Modalidade</Label>
              <select
                id="modality"
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value as "presencial" | "online" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.phone_ddi}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (v && !v.startsWith("+")) v = "+" + v;
                      setForm({ ...form, phone_ddi: v });
                    }}
                    className="w-[80px] shrink-0 text-center"
                    placeholder="+55"
                    maxLength={5}
                  />
                  <Input id="phone" className="flex-1" placeholder="11 99988-7766" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Valor da sessão (R$)</Label>
              <Input id="price" type="number" step="0.01" min="0" value={form.session_price} onChange={(e) => setForm({ ...form, session_price: e.target.value })} />
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="has_financial_responsible" className="text-sm font-medium">Responsável financeiro é outra pessoa?</Label>
                <Switch
                  id="has_financial_responsible"
                  checked={form.has_financial_responsible}
                  onCheckedChange={(checked) => setForm({ ...form, has_financial_responsible: checked })}
                />
              </div>
              {form.has_financial_responsible && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="fr_name">Nome do responsável</Label>
                    <Input id="fr_name" placeholder="Nome completo" value={form.financial_responsible_name} onChange={(e) => setForm({ ...form, financial_responsible_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fr_phone">Celular / WhatsApp do responsável</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.financial_responsible_ddi}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (v && !v.startsWith("+")) v = "+" + v;
                          setForm({ ...form, financial_responsible_ddi: v });
                        }}
                        className="w-[80px] shrink-0 text-center"
                        placeholder="+55"
                        maxLength={5}
                      />
                      <Input id="fr_phone" className="flex-1" placeholder="11 99988-7766" value={form.financial_responsible_phone} onChange={(e) => setForm({ ...form, financial_responsible_phone: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="treatment_start_date">Início do tratamento</Label>
                <Input id="treatment_start_date" type="date" value={form.treatment_start_date} onChange={(e) => setForm({ ...form, treatment_start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment_end_date">Término do tratamento</Label>
                <Input id="treatment_end_date" type="date" value={form.treatment_end_date} onChange={(e) => setForm({ ...form, treatment_end_date: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="has_psychiatrist" className="text-sm font-medium">Faz acompanhamento psiquiátrico?</Label>
                <Switch
                  id="has_psychiatrist"
                  checked={form.has_psychiatrist}
                  onCheckedChange={(checked) => setForm({ ...form, has_psychiatrist: checked })}
                />
              </div>
              {form.has_psychiatrist && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="psychiatrist_name">Nome do médico</Label>
                    <Input id="psychiatrist_name" placeholder="Nome do psiquiatra" value={form.psychiatrist_name} onChange={(e) => setForm({ ...form, psychiatrist_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="psychiatrist_phone">WhatsApp do médico</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.psychiatrist_phone_ddi}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (v && !v.startsWith("+")) v = "+" + v;
                          setForm({ ...form, psychiatrist_phone_ddi: v });
                        }}
                        className="w-[80px] shrink-0 text-center"
                        placeholder="+55"
                        maxLength={5}
                      />
                      <Input id="psychiatrist_phone" className="flex-1" placeholder="11 99988-7766" value={form.psychiatrist_phone} onChange={(e) => setForm({ ...form, psychiatrist_phone: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">Medicamentos em uso</Label>
              <Textarea id="medications" rows={3} className="min-h-[80px]" placeholder="Liste os medicamentos que o paciente toma atualmente..." value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chief_complaint">Queixa Principal</Label>
              <Textarea id="chief_complaint" rows={3} className="min-h-[80px]" placeholder="Descreva a queixa principal do paciente..." value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment_plan">Plano de Tratamento</Label>
              <Textarea id="treatment_plan" rows={4} className="min-h-[100px]" placeholder="Objetivos terapêuticos, intervenções planejadas..." value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anamnesis">Histórico / Anamnese</Label>
              <Textarea id="anamnesis" rows={5} className="min-h-[120px]" placeholder="Histórico pessoal, familiar, médico..." value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => patientGuard.guardClose(() => { if (!editing) clearDraft(); setOpen(false); }, () => setOpen(false))}>Cancelar</Button>
              <Button type="submit" variant="accent" className="min-h-[44px]" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tccPatient} onOpenChange={(o) => !o && setTccPatient(null)}>
        <DialogContent className={dlgCls("tcc")}>
          <FullBtn k="tcc" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{tccPatient?.full_name}</DialogTitle>
            <DialogDescription>RPD — Registro de Pensamentos Disfuncionais</DialogDescription>
          </DialogHeader>
          {tccPatient && <TccRecords patientId={tccPatient.id} />}
        </DialogContent>
      </Dialog>

      {/* Formulação de Caso Dialog */}
      <Dialog open={!!padeksyPatient} onOpenChange={(o) => !o && setPadeksyPatient(null)}>
        <DialogContent className={`${dlgCls("padesky")} [&_textarea]:scroll-mt-24 [&_input]:scroll-mt-24`}>
          <FullBtn k="padesky" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{padeksyPatient?.full_name}</DialogTitle>
            <DialogDescription>Formulação de Caso — com coach de IA baseada em 5 Aspectos</DialogDescription>
          </DialogHeader>
          {padeksyPatient && <CaseFormulation patientId={padeksyPatient.id} />}
        </DialogContent>
      </Dialog>

      {/* Ler Formulação (PDF-like) Dialog */}
      {/* Full "Resumo do cadastro" dialog */}
      <Dialog open={!!summaryPatient} onOpenChange={(o) => !o && setSummaryPatient(null)}>
        <DialogContent className="w-[calc(100%-1rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo do cadastro — {summaryPatient?.full_name}</DialogTitle>
            <DialogDescription>Dados completos cadastrados para este paciente.</DialogDescription>
          </DialogHeader>
          {summaryPatient && (() => {
            const tp2 = treatmentPlans[summaryPatient.id];
            const planText = tp2?.conceitualizacao?.trim() || summaryPatient.treatment_plan?.trim() || "";
            const blocks: Array<{ label: string; text: string }> = [];
            if (summaryPatient.chief_complaint?.trim()) blocks.push({ label: "Queixa principal", text: summaryPatient.chief_complaint });
            if (summaryPatient.anamnesis?.trim()) blocks.push({ label: "Anamnese", text: summaryPatient.anamnesis });
            if (summaryPatient.notes?.trim()) blocks.push({ label: "Notas clínicas", text: summaryPatient.notes });
            if (planText) blocks.push({ label: "Plano de tratamento", text: planText });
            if (summaryPatient.medications?.trim()) blocks.push({ label: "Medicações", text: summaryPatient.medications });
            if (summaryPatient.psychiatrist_name?.trim()) blocks.push({ label: "Psiquiatra", text: `${summaryPatient.psychiatrist_name}${summaryPatient.psychiatrist_phone ? ` · ${summaryPatient.psychiatrist_phone}` : ""}` });
            if (summaryPatient.financial_responsible_name?.trim()) blocks.push({ label: "Responsável financeiro", text: `${summaryPatient.financial_responsible_name}${summaryPatient.financial_responsible_phone ? ` · ${summaryPatient.financial_responsible_phone}` : ""}` });
            if (blocks.length === 0) {
              return <p className="text-sm text-muted-foreground">Nenhum dado preenchido ainda.</p>;
            }
            return (
              <div className="space-y-4 mt-2">
                {blocks.map((b) => (
                  <div key={b.label} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">{b.label}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{b.text}</p>
                  </div>
                ))}
              </div>
            );
          })()}
          <DialogFooter>
            {summaryPatient && (
              <Button variant="outline" onClick={() => { const p = summaryPatient; setSummaryPatient(null); openEdit(p); }}>
                <Pencil className="h-4 w-4" /> Editar cadastro
              </Button>
            )}
            <Button variant="accent" onClick={() => setSummaryPatient(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!readPatient} onOpenChange={(o) => !o && setReadPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 bg-muted">
          <DialogHeader className="sr-only">
            <DialogTitle>Formulação de Caso — {readPatient?.full_name}</DialogTitle>
          </DialogHeader>
          {readPatient && (() => {
            const f = formulationData[readPatient.id] || {};
            const goals: any[] = Array.isArray(f.treatment_goals) ? f.treatment_goals : [];
            const sum = formulationSummaries[readPatient.id];
            const updated = formulationFilled[readPatient.id];
            const Section = ({ title, content }: { title: string; content?: string }) => (
              <section className="mb-6">
                <h2 className="uppercase mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(var(--brown))", borderBottom: "0.5px solid rgba(201,168,76,0.4)", paddingBottom: 4 }}>{title}</h2>
                <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{content?.trim() || <span className="italic text-muted-foreground">— não preenchido —</span>}</p>
              </section>
            );
            return (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white/90 backdrop-blur border-b border-border">
                  <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: "hsl(var(--primary-dark))" }}>Formulação de Caso</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const node = document.getElementById("formulation-print");
                      if (!node) return;
                      const w = window.open("", "_blank", "width=900,height=1000");
                      if (!w) { toast.error("Permita pop-ups para gerar o PDF."); return; }
                      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Formulação - ${(readPatient?.full_name || "").replace(/[<>&"]/g, "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>@page{margin:18mm} *{box-sizing:border-box} body{margin:0;background:#fff;color:hsl(var(--foreground));font-family:'Instrument Sans',sans-serif} .wrap{padding:0}</style>
</head><body><div class="wrap">${node.innerHTML}</div>
<script>window.addEventListener('load',()=>{setTimeout(()=>{window.focus();window.print();},300);});</script>
</body></html>`;
                      w.document.open(); w.document.write(html); w.document.close();
                    }} className="inline-flex items-center gap-1.5" style={{ background: "#fff", border: "0.5px solid hsl(var(--border))", color: "hsl(var(--primary-dark))", padding: "6px 12px", borderRadius: 40, fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 11 }}>
                      <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
                    </button>
                    <button onClick={() => { setReadPatient(null); setPadeksyPatient(readPatient); }} className="inline-flex items-center gap-1.5" style={{ background: "hsl(var(--primary))", color: "#fff", padding: "6px 12px", borderRadius: 40, fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 11 }}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                </div>
                <div id="formulation-print" className="px-10 py-10 bg-white mx-6 my-6 rounded-lg shadow-sm" style={{ minHeight: "60vh" }}>
                  <div className="mb-8 pb-4 border-b border-border">
                    <p className="uppercase" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "hsl(var(--muted-foreground))" }}>Prontuário Clínico · 5 Aspectos</p>
                    <h1 className="mt-2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 26, color: "hsl(var(--foreground))" }}>{readPatient.full_name}</h1>
                    {updated && (
                      <p className="mt-1" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "hsl(var(--primary-glow))" }}>
                        Atualizada em {format(new Date(updated), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  {sum && (
                    <section className="mb-6 rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.10), rgba(150,117,206,0.06))", border: "0.5px solid rgba(201,168,76,0.3)" }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--gold))" }} />
                        <span className="uppercase" style={{ fontFamily: "Syne, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(var(--brown))" }}>Resumo IA · Destaques</span>
                      </div>
                      <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{sum}</p>
                    </section>
                  )}
                  <Section title="Ambiente / Situação" content={f.environment} />
                  <Section title="Pensamentos" content={f.thoughts} />
                  <Section title="Emoções" content={f.emotions} />
                  <Section title="Comportamentos" content={f.behaviors} />
                  <Section title="Reações físicas" content={f.physical_reactions} />
                  <Section title="Crenças centrais" content={f.core_beliefs} />
                  <section className="mb-2">
                    <h2 className="uppercase mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(var(--brown))", borderBottom: "0.5px solid rgba(201,168,76,0.4)", paddingBottom: 4 }}>Metas terapêuticas</h2>
                    {goals.length === 0 ? (
                      <p className="italic text-muted-foreground" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13 }}>— não preenchido —</p>
                    ) : (
                      <ol className="list-decimal pl-5 space-y-1" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.6 }}>
                        {goals.map((g, i) => (
                          <li key={i}>{typeof g === "string" ? g : (g?.objective || g?.text || g?.title || g?.description || "—")}</li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
                <style>{`@media print {
                  @page { margin: 18mm; }
                  html, body { background: #fff !important; }
                  body * { visibility: hidden !important; }
                  #formulation-print, #formulation-print * { visibility: visible !important; }
                  #formulation-print {
                    position: fixed !important;
                    inset: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                    background: #fff !important;
                    overflow: visible !important;
                  }
                }`}</style>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Session History Dialog */}
      <Dialog open={!!historyPatient} onOpenChange={(o) => !o && setHistoryPatient(null)}>
        <DialogContent className={dlgCls("hist")}>
          <FullBtn k="hist" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{historyPatient?.full_name}</DialogTitle>
            <DialogDescription>Histórico de sessões e evolução do humor</DialogDescription>
          </DialogHeader>
          {historyPatient && <PatientSessionHistory patientId={historyPatient.id} patientName={historyPatient.full_name} />}
        </DialogContent>
      </Dialog>

      {/* Session Records Dialog */}
      <Dialog open={!!recordsPatient} onOpenChange={(o) => !o && setRecordsPatient(null)}>
        <DialogContent className={dlgCls("rec")}>
          <FullBtn k="rec" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{recordsPatient?.full_name}</DialogTitle>
            <DialogDescription>Registros de sessão (prontuário clínico)</DialogDescription>
          </DialogHeader>
          {recordsPatient && <PatientSessionRecords patientId={recordsPatient.id} patientName={recordsPatient.full_name} />}
        </DialogContent>
      </Dialog>

      {/* Mood Chart Dialog */}
      <Dialog open={!!moodPatient} onOpenChange={(o) => !o && setMoodPatient(null)}>
        <DialogContent className={dlgCls("mood")}>
          <FullBtn k="mood" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{moodPatient?.full_name}</DialogTitle>
            <DialogDescription>Evolução do humor ao longo do tempo</DialogDescription>
          </DialogHeader>
          {moodPatient && <PatientMoodChart patientId={moodPatient.id} patientName={moodPatient.full_name} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!anamnesisPatient} onOpenChange={(o) => !o && setAnamnesisPatient(null)}>
        <DialogContent className={dlgCls("anam")}>
          <FullBtn k="anam" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{anamnesisPatient?.full_name}</DialogTitle>
            <DialogDescription>Anamnese — Informações do paciente criança</DialogDescription>
          </DialogHeader>
          {anamnesisPatient && (
            <ChildAnamnesisForm
              patientId={anamnesisPatient.id}
              patientName={anamnesisPatient.full_name}
              onSaved={() => setAnamnesisPatient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Homework Dialog */}
      <Dialog open={!!homeworkPatient} onOpenChange={(o) => !o && setHomeworkPatient(null)}>
        <DialogContent className={dlgCls("hw")}>
          <FullBtn k="hw" />
          <DialogHeader>
            <DialogTitle className="font-display text-lg sm:text-2xl break-words pr-8">{homeworkPatient?.full_name}</DialogTitle>
            <DialogDescription>Tarefas de casa — envie por WhatsApp e gere PDF</DialogDescription>
          </DialogHeader>
          {homeworkPatient && (
            <PatientHomework
              patientId={homeworkPatient.id}
              patientName={homeworkPatient.full_name}
              patientPhone={homeworkPatient.phone}
              homeworkToken={(homeworkPatient as any).homework_token ?? null}
              therapistFirstName={profName ? profName.split(" ")[0] : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      <PremiumGate open={gateOpen} onOpenChange={setGateOpen} />
      <UnsavedGuardDialog open={patientGuard.confirmOpen} onConfirm={patientGuard.confirmLeave} onCancel={patientGuard.cancelLeave} onSaveDraft={patientGuard.saveDraftAndLeave} />
    </div>
  );
};

export default Patients;
