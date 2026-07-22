import { useEffect, useRef, useState, useCallback } from "react";
import { HelpCard } from "@/components/app/HelpCard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, AlertTriangle, Sparkles, ChevronDown, ChevronUp, Pencil, Trash2, X, User, CalendarDays, Clock, Video, MapPin, FileText, ClipboardList, Stethoscope, History, Minimize2, Maximize2, Target, ExternalLink, ArrowLeft, CheckSquare, RefreshCw, NotebookPen, Pencil as PencilIcon } from "lucide-react";
import { RegistroSessaoHub } from "@/components/app/RegistroSessaoHub";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UnsavedGuardDialog } from "@/components/app/UnsavedGuardDialog";
import { SessionPlanningForm } from "@/components/app/SessionPlanningForm";
import { HomeworkPlanForm, type HomeworkPlanFormTask } from "@/components/app/HomeworkPlanForm";
import { preserveScroll } from "@/lib/preserveScroll";
import { PageIntro } from "@/components/app/PageIntro";

const DRAFT_KEY = "rascunho_registro_sessao";

const THEME_CHIPS = [
  "Ansiedade",
  "Autoestima",
  "Relacionamentos",
  "Família",
  "Trabalho",
  "Luto",
  "Trauma",
  "Identidade",
  "Corpo",
  "Sono",
];

const RISK_OPTIONS = [
  { value: "none", label: "Sem risco identificado" },
  { value: "low", label: "Risco baixo" },
  { value: "moderate", label: "Risco moderado" },
  { value: "high", label: "Risco alto" },
];

const ENGAGEMENT_LABELS = ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"];

interface Patient {
  id: string;
  full_name: string;
  phone?: string | null;
  homework_token?: string | null;
}

interface SavedRecord {
  id: string;
  patient_id: string;
  session_date: string;
  session_number: number | null;
  modality: string;
  duration_minutes: number;
  chief_complaint: string;
  themes: string[];
  clinical_observations: string;
  next_session_plan: string;
  engagement: number | null;
  risk_indicator: string;
  private_notes: string;
  created_at: string;
}

const emptyForm = {
  patient_id: "",
  session_id: null as string | null,
  session_date: format(new Date(), "yyyy-MM-dd"),
  session_number: "",
  modality: "presencial",
  duration_minutes: 50,
  chief_complaint: "",
  themes: [] as string[],
  clinical_observations: "",
  next_session_plan: "",
  engagement: 3,
  risk_indicator: "none",
  private_notes: "",
  plan_id: null as string | null,
  // Bloco "Próxima sessão" — fonte única do planejamento
  next_scheduled_at: "" as string, // datetime-local (yyyy-MM-ddTHH:mm) — vazio = não agendar
  next_objetivo: "",
  next_retomar: "",
  next_meta_id: null as string | null,
  next_tecnicas: [] as string[],
  next_observacoes: "",
};

type FormState = typeof emptyForm;

function hasMeaningfulData(f: FormState): boolean {
  return !!(
    f.patient_id ||
    f.chief_complaint.trim() ||
    f.clinical_observations.trim() ||
    f.next_session_plan.trim() ||
    f.private_notes.trim() ||
    f.themes.length > 0 ||
    f.next_objetivo.trim() ||
    f.next_retomar.trim() ||
    f.next_observacoes.trim() ||
    f.next_tecnicas.length > 0
  );
}

const RegistroSessao = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Saved records
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterModality, setFilterModality] = useState("all");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});

  // Active treatment plan + next session planning for selected patient
  const [activePlan, setActivePlan] = useState<{
    plan_id: string | null;
    plan_status: string | null;
    objetivo: string;
    retomar: string;
    tecnicas: string[];
    observacoes: string;
    meta_descricao: string | null;
    scheduled_at: string | null;
    goals: { descricao: string }[];
    pending_tasks: { id: string; title: string }[];
    next_revision: { data: string; descricao: string } | null;
    loaded: boolean;
  }>({ plan_id: null, plan_status: null, objetivo: "", retomar: "", tecnicas: [], observacoes: "", meta_descricao: null, scheduled_at: null, goals: [], pending_tasks: [], next_revision: null, loaded: false });
  const [planPanelCollapsed, setPlanPanelCollapsed] = useState(false);
  const [planLoadedIntoForm, setPlanLoadedIntoForm] = useState(false);
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);

  // Metas e técnicas do plano ativo — usadas pelo bloco "Próxima sessão"
  const [planGoals, setPlanGoals] = useState<{ id: string; tipo: string; descricao: string }[]>([]);
  const [planTechniques, setPlanTechniques] = useState<{ id: string; nome: string }[]>([]);
  // ID da sessão futura já agendada para o paciente (usado no upsert de session_plans)
  const [nextSessionId, setNextSessionId] = useState<string | null>(null);
  // Diálogo pós-salvar quando paciente não tiver plano ativo
  const [noPlanDialogOpen, setNoPlanDialogOpen] = useState(false);
  const [noPlanContext, setNoPlanContext] = useState<{
    patientId: string;
    objetivo: string;
    metaId: string | null;
    metaDescricao: string | null;
    tecnicas: string[];
  } | null>(null);
  const [creatingDraftPlan, setCreatingDraftPlan] = useState(false);
  // Foco automático no bloco de próxima sessão quando vier de "Editar planejamento"
  const proximaSessaoRef = useRef<HTMLElement | null>(null);
  const [focusProximaSessao, setFocusProximaSessao] = useState(false);
  // Ref/estado para destaque da seleção de sessão-alvo quando houver empate
  const ambiguousRef = useRef<HTMLElement | null>(null);
  const [ambiguousPick, setAmbiguousPick] = useState<string | null>(null);
  const [ambiguousHighlight, setAmbiguousHighlight] = useState(false);

  const loadActivePlan = useCallback(async (patientId: string, uid: string, currentSessionId?: string | null) => {
    // 1. Active treatment plan for this patient
    const { data: tp } = await supabase
      .from("treatment_plans")
      .select("id, status")
      .eq("patient_id", patientId)
      .eq("user_id", uid)
      .maybeSingle();

    // 2. Próxima sessão futura — seleção determinística com detecção de empate
    // Regras: exclui sessão atual, ignora canceladas/no_show, ordena por
    // scheduled_at, created_at, id. Se houver 2+ sessões válidas com o mesmo
    // scheduled_at, NÃO vincular automaticamente — a psicóloga escolhe.
    let nsQuery = supabase
      .from("sessions")
      .select("id, scheduled_at, created_at, modality, duration_minutes, notes")
      .eq("patient_id", patientId)
      .eq("user_id", uid)
      .gte("scheduled_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .not("status", "in", "(cancelled,no_show)")
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(5);
    if (currentSessionId) nsQuery = nsQuery.neq("id", currentSessionId);
    const { data: nsList } = await nsQuery;
    const rows: any[] = nsList ?? [];
    let ns: any = null;
    const tied: any[] = [];
    if (rows.length > 0) {
      const first = rows[0];
      for (const r of rows) if (r.scheduled_at === first.scheduled_at) tied.push(r);
      if (tied.length === 1) ns = first;
    }
    setAmbiguousNext(tied.length > 1 ? tied : []);

    let sp: any = null;
    if (ns?.id) {
      const { data } = await supabase
        .from("session_plans")
        .select("id, objetivo, retomar, tecnicas, observacoes, meta_id")
        .eq("session_id", ns.id)
        .maybeSingle();
      sp = data;
    }

    let meta_descricao: string | null = null;
    if (sp?.meta_id) {
      const { data: m } = await supabase.from("treatment_goals").select("descricao").eq("id", sp.meta_id).maybeSingle();
      meta_descricao = m?.descricao ?? null;
    }

    // Metas e técnicas do plano (para o select/chips do bloco Próxima sessão)
    const [{ data: goalsFull }, { data: techsFull }] = await Promise.all([
      supabase
        .from("treatment_goals")
        .select("id, tipo, descricao, ordem")
        .eq("patient_id", patientId)
        .order("ordem"),
      supabase
        .from("treatment_techniques")
        .select("id, nome")
        .eq("patient_id", patientId)
        .order("created_at"),
    ]);
    const fullGoals = ((goalsFull as any[]) ?? [])
      .filter((g) => g.descricao?.trim())
      .map((g) => ({ id: g.id, tipo: g.tipo, descricao: g.descricao }));
    const fullTechs = ((techsFull as any[]) ?? [])
      .filter((t) => t.nome?.trim())
      .map((t) => ({ id: t.id, nome: t.nome }));
    setPlanGoals(fullGoals);
    setPlanTechniques(fullTechs);

    // Objetivos terapêuticos ativos (compat com painel resumido existente)
    const goals: { descricao: string }[] = fullGoals.map((x) => ({ descricao: x.descricao }));

    // 4. Tarefas pendentes (homework com pelo menos uma action !done)
    const { data: tasksData } = await supabase
      .from("homework_tasks")
      .select("id, title, actions")
      .eq("patient_id", patientId)
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    const pending_tasks = ((tasksData as any[]) ?? []).filter((t) => {
      const acts = Array.isArray(t.actions) ? t.actions : [];
      if (acts.length === 0) return true;
      return acts.some((a: any) => !a?.done);
    }).map((t) => ({ id: t.id, title: t.title }));

    // 5. Última revisão do plano
    const { data: rev } = await supabase
      .from("treatment_revisions")
      .select("data, descricao")
      .eq("patient_id", patientId)
      .eq("user_id", uid)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActivePlan({
      plan_id: tp?.id ?? null,
      plan_status: tp?.status ?? null,
      objetivo: sp?.objetivo || "",
      retomar: sp?.retomar || "",
      tecnicas: sp?.tecnicas || [],
      observacoes: sp?.observacoes || "",
      meta_descricao,
      scheduled_at: ns?.scheduled_at ?? null,
      goals,
      pending_tasks,
      next_revision: rev ? { data: rev.data, descricao: rev.descricao } : null,
      loaded: true,
    });

    setNextSessionId(ns?.id ?? null);

    // Pré-preencher bloco "Próxima sessão" com o planejamento salvo,
    // desde que o usuário ainda não tenha começado a digitar algo lá.
    // Data/hora sempre reflete a próxima sessão agendada quando existir (campo travado na UI).
    setForm((prev) => {
      const lockedScheduled = ns?.scheduled_at
        ? format(new Date(ns.scheduled_at), "yyyy-MM-dd'T'HH:mm")
        : null;
      const hasUserInput =
        prev.next_objetivo.trim() ||
        prev.next_retomar.trim() ||
        prev.next_observacoes.trim() ||
        prev.next_tecnicas.length > 0 ||
        prev.next_meta_id;
      if (hasUserInput) {
        // preserva conteúdo do usuário, mas sincroniza a data quando há sessão agendada
        return lockedScheduled ? { ...prev, next_scheduled_at: lockedScheduled } : prev;
      }
      return {
        ...prev,
        next_objetivo: sp?.objetivo || "",
        next_retomar: sp?.retomar || "",
        next_observacoes: sp?.observacoes || "",
        next_tecnicas: Array.isArray(sp?.tecnicas) ? sp.tecnicas : [],
        next_meta_id: sp?.meta_id ?? null,
        next_scheduled_at: lockedScheduled ?? "",
      };
    });
  }, []);

  // Sessões futuras empatadas no mesmo horário — psicóloga escolhe manualmente
  const [ambiguousNext, setAmbiguousNext] = useState<Array<{ id: string; scheduled_at: string; created_at?: string; modality?: string; duration_minutes?: number; notes?: string | null }>>([]);

  // Aplica manualmente a sessão-alvo escolhida pela psicóloga entre empatadas
  const chooseNextSession = useCallback(async (sessionId: string) => {
    const picked = ambiguousNext.find((r) => r.id === sessionId);
    if (!picked) return;
    setNextSessionId(sessionId);
    const { data: sp } = await supabase
      .from("session_plans")
      .select("id, objetivo, retomar, tecnicas, observacoes, meta_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    let meta_descricao: string | null = null;
    if (sp?.meta_id) {
      const { data: m } = await supabase.from("treatment_goals").select("descricao").eq("id", sp.meta_id).maybeSingle();
      meta_descricao = m?.descricao ?? null;
    }
    setActivePlan((prev) => ({
      ...prev,
      objetivo: sp?.objetivo || "",
      retomar: sp?.retomar || "",
      tecnicas: sp?.tecnicas || [],
      observacoes: sp?.observacoes || "",
      meta_descricao,
      scheduled_at: picked.scheduled_at,
    }));
    setForm((prev) => {
      const lockedScheduled = format(new Date(picked.scheduled_at), "yyyy-MM-dd'T'HH:mm");
      const hasUserInput =
        prev.next_objetivo.trim() ||
        prev.next_retomar.trim() ||
        prev.next_observacoes.trim() ||
        prev.next_tecnicas.length > 0 ||
        prev.next_meta_id;
      if (hasUserInput) return { ...prev, next_scheduled_at: lockedScheduled };
      return {
        ...prev,
        next_objetivo: sp?.objetivo || "",
        next_retomar: sp?.retomar || "",
        next_observacoes: sp?.observacoes || "",
        next_tecnicas: Array.isArray(sp?.tecnicas) ? sp.tecnicas : [],
        next_meta_id: sp?.meta_id ?? null,
        next_scheduled_at: lockedScheduled,
      };
    });
    setAmbiguousNext([]);
  }, [ambiguousNext]);


  // Planejamento trazido da sessão anterior (session_plans atrelado à sessão atual)
  const [broughtPlanning, setBroughtPlanning] = useState<{
    objetivo: string;
    retomar: string;
    tecnicas: string[];
    observacoes: string;
    meta_descricao: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user || !form.patient_id) {
      setActivePlan({ plan_id: null, plan_status: null, objetivo: "", retomar: "", tecnicas: [], observacoes: "", meta_descricao: null, scheduled_at: null, goals: [], pending_tasks: [], next_revision: null, loaded: false });
      setPlanGoals([]);
      setPlanTechniques([]);
      setNextSessionId(null);
      setPlanPanelCollapsed(false);
      setPlanLoadedIntoForm(false);
      setBroughtPlanning(null);
      return;
    }
    loadActivePlan(form.patient_id, user.id, form.session_id);
    setPlanPanelCollapsed(false);
    setPlanLoadedIntoForm(false);
  }, [user, form.patient_id, form.session_id, loadActivePlan]);

  // Buscar planejamento trazido (o session_plan atrelado à sessão atual)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.session_id) { setBroughtPlanning(null); return; }
      const { data: sp } = await supabase
        .from("session_plans")
        .select("objetivo, retomar, tecnicas, observacoes, meta_id")
        .eq("session_id", form.session_id)
        .maybeSingle();
      if (cancelled) return;
      if (!sp) { setBroughtPlanning(null); return; }
      let meta_descricao: string | null = null;
      if (sp.meta_id) {
        const { data: m } = await supabase.from("treatment_goals").select("descricao").eq("id", sp.meta_id).maybeSingle();
        meta_descricao = m?.descricao ?? null;
      }
      setBroughtPlanning({
        objetivo: sp.objetivo ?? "",
        retomar: sp.retomar ?? "",
        tecnicas: Array.isArray(sp.tecnicas) ? sp.tecnicas : [],
        observacoes: sp.observacoes ?? "",
        meta_descricao,
      });
    })();
    return () => { cancelled = true; };
  }, [form.session_id]);

  // Plano entre Sessões atrelado à sessão atual (para renderização inline no Registro)
  const [homeworkTask, setHomeworkTask] = useState<HomeworkPlanFormTask | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.session_id || !form.patient_id || !user) { setHomeworkTask(null); return; }
      const { data } = await supabase
        .from("homework_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("patient_id", form.patient_id)
        .eq("session_id", form.session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setHomeworkTask((data as HomeworkPlanFormTask) ?? null);
    })();
    return () => { cancelled = true; };
  }, [form.session_id, form.patient_id, user]);

  // Se veio de "Editar planejamento" no Plano Terapêutico, rola até o bloco
  useEffect(() => {
    if (searchParams.get("focus") !== "proxima-sessao") return;
    if (!form.patient_id) return;
    const t = setTimeout(() => {
      const el = document.getElementById("proxima-sessao");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => clearTimeout(t);
  }, [searchParams, form.patient_id]);

  const applyPlanningToForm = () => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const containsLine = (haystack: string, needle: string) => {
      const h = norm(haystack);
      const n = norm(needle);
      return n.length > 0 && h.includes(n);
    };
    let addedGoal = false;
    let addedObs = false;
    let addedTechniques = 0;
    let addedTasks = 0;

    setForm((prev) => {
      const next = { ...prev, plan_id: activePlan.plan_id ?? prev.plan_id };

      // Objetivo terapêutico (meta) → queixa principal
      if (activePlan.meta_descricao) {
        if (!prev.chief_complaint.trim()) {
          next.chief_complaint = activePlan.meta_descricao;
          addedGoal = true;
        } else if (!containsLine(prev.chief_complaint, activePlan.meta_descricao)) {
          next.chief_complaint = `${prev.chief_complaint.trimEnd()}\n\nObjetivo do plano: ${activePlan.meta_descricao}`;
          addedGoal = true;
        }
      }

      // "Retomar da última sessão" → observações clínicas
      if (activePlan.retomar) {
        if (!prev.clinical_observations.trim()) {
          next.clinical_observations = activePlan.retomar;
          addedObs = true;
        } else if (!containsLine(prev.clinical_observations, activePlan.retomar)) {
          next.clinical_observations = `${prev.clinical_observations.trimEnd()}\n\nRetomar do plano: ${activePlan.retomar}`;
          addedObs = true;
        }
      }

      // Técnicas planejadas → themes (dedup case-insensitive)
      if (activePlan.tecnicas.length) {
        const existingNorm = new Set(prev.themes.map(norm));
        const toAdd = activePlan.tecnicas.filter((t) => t.trim() && !existingNorm.has(norm(t)));
        if (toAdd.length) {
          next.themes = [...prev.themes, ...toAdd];
          addedTechniques = toAdd.length;
        }
      }

      // Tarefas pendentes → plano da próxima sessão (append linhas ausentes)
      if (activePlan.pending_tasks.length) {
        const existing = prev.next_session_plan;
        const linesToAdd = activePlan.pending_tasks
          .filter((t) => t.title.trim() && !containsLine(existing, t.title))
          .map((t) => `• ${t.title}`);
        if (linesToAdd.length) {
          next.next_session_plan = existing.trim()
            ? `${existing.trimEnd()}\n${linesToAdd.join("\n")}`
            : linesToAdd.join("\n");
          addedTasks = linesToAdd.length;
        }
      }

      return next;
    });

    setPlanLoadedIntoForm(true);
    setPlanPanelCollapsed(true);

    const parts: string[] = [];
    if (addedGoal) parts.push("objetivo");
    if (addedObs) parts.push("retomada");
    if (addedTechniques) parts.push(`${addedTechniques} técnica${addedTechniques > 1 ? "s" : ""}`);
    if (addedTasks) parts.push(`${addedTasks} tarefa${addedTasks > 1 ? "s" : ""}`);
    if (parts.length === 0) {
      toast.info("Plano já está refletido no registro — nada foi duplicado");
    } else {
      toast.success(`Plano carregado: ${parts.join(", ")}`);
    }
  };


  // Compact mode: collapses long sections to just headers; persists in localStorage
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try { return localStorage.getItem("registro_sessao_compact") === "1"; } catch { return false; }
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { localStorage.setItem("registro_sessao_compact", compactMode ? "1" : "0"); } catch {}
  }, [compactMode]);
  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const isOpen = useCallback(
    (key: string) => !compactMode || expandedSections[key] === true,
    [compactMode, expandedSections],
  );

  // --- Draft auto-save ---
  // Keep a ref with the latest form so event listeners always read fresh data
  const formRef = useRef(form);
  const editingIdRef = useRef(editingId);
  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  const draftKeyFor = useCallback(
    (id: string | null) => (id ? `${DRAFT_KEY}::${id}` : DRAFT_KEY),
    []
  );

  const flushDraft = useCallback(() => {
    try {
      const f = formRef.current;
      if (hasMeaningfulData(f)) {
        localStorage.setItem(draftKeyFor(editingIdRef.current), JSON.stringify(f));
      }
    } catch {
      /* storage may be full or unavailable — ignore */
    }
  }, [draftKeyFor]);

  // Save draft on every meaningful change (covers typing pauses)
  useEffect(() => {
    if (hasMeaningfulData(form)) {
      try {
        localStorage.setItem(draftKeyFor(editingId), JSON.stringify(form));
        setLastSavedAt(new Date());
      } catch {}
    }
  }, [form, editingId, draftKeyFor]);

  // Save when the tab is hidden/minimized, window blurs, app is being closed,
  // network drops, or page navigation occurs.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") flushDraft(); };
    const onPageHide = () => flushDraft();
    const onBlur = () => flushDraft();
    const onOffline = () => flushDraft();
    const onBeforeUnload = () => {
      flushDraft();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Periodic safety net: every 10s save in background
    const interval = window.setInterval(flushDraft, 10000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(interval);
      // Final flush on unmount (route change)
      flushDraft();
    };
  }, [flushDraft]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKeyFor(editingIdRef.current));
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setDraftRestored(false);
  }, [draftKeyFor]);

  // Restore draft on mount (new records or when editing resumes)
  useEffect(() => {
    try {
      const key = draftKeyFor(editingId);
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as FormState;
        if (hasMeaningfulData(saved)) {
          setForm(saved);
          setDraftRestored(true);
          toast.info("Rascunho recuperado. Continue de onde parou.");
        }
      }
    } catch {
      try { localStorage.removeItem(draftKeyFor(editingId)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill from URL (?patient=…&session=…) — reativo a searchParams (KeepAliveOutlet mantém o componente vivo).
  // Guard por ref evita reaplicar o mesmo par (patient|session) em loop.
  const lastPrefillKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || editingId) return;
    const patientParam = searchParams.get("patient");
    const sessionParam = searchParams.get("session");
    if (!patientParam && !sessionParam) return;
    const key = `${patientParam ?? ""}|${sessionParam ?? ""}`;
    if (lastPrefillKeyRef.current === key) return;
    lastPrefillKeyRef.current = key;
    (async () => {
      let prefill: Partial<FormState> = {};
      if (patientParam) prefill.patient_id = patientParam;
      if (sessionParam) {
        const { data: sess } = await supabase
          .from("sessions")
          .select("id, patient_id, scheduled_at, duration_minutes, modality")
          .eq("id", sessionParam)
          .maybeSingle();
        if (sess) {
          prefill.session_id = sess.id;
          prefill.patient_id = sess.patient_id ?? prefill.patient_id ?? "";
          prefill.session_date = format(new Date(sess.scheduled_at), "yyyy-MM-dd");
          if (sess.duration_minutes) prefill.duration_minutes = sess.duration_minutes;
          if (sess.modality) prefill.modality = sess.modality;
        }
      }
      setForm((prev) => {
        const urlPatient = prefill.patient_id;
        const switchingPatient = !!urlPatient && !!prev.patient_id && urlPatient !== prev.patient_id;
        const switchingSession = !!prefill.session_id && prev.session_id !== prefill.session_id;
        // URL prevalece sobre rascunho quando muda o paciente OU a sessão-alvo.
        if (switchingPatient || switchingSession) {
          try { localStorage.removeItem(draftKeyFor(editingId)); } catch {}
          setDraftRestored(false);
          return {
            ...emptyForm,
            // preserva preferências de layout
            session_date: prefill.session_date ?? format(new Date(), "yyyy-MM-dd"),
            duration_minutes: prefill.duration_minutes ?? emptyForm.duration_minutes,
            modality: prefill.modality ?? emptyForm.modality,
            patient_id: urlPatient ?? "",
            session_id: prefill.session_id ?? null,
          };
        }
        // Sem rascunho relevante: aplica o prefill normalmente.
        if (!hasMeaningfulData(prev) || !prev.patient_id) {
          return {
            ...prev,
            ...prefill,
            // limpa campos next_* para forçar loadActivePlan a recarregar
            next_session_plan: "",
            next_objetivo: "",
            next_retomar: "",
            next_observacoes: "",
            next_tecnicas: [],
            next_meta_id: null,
            next_scheduled_at: "",
          };
        }
        return prev;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, editingId, searchParams]);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("session_records")
      .select("*")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .limit(50);
    setRecords((data as SavedRecord[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone, homework_token")
        .eq("is_active", true)
        .order("full_name");
      setPatients(data ?? []);
      await loadRecords();
      setLoading(false);
    })();
  }, [user, loadRecords]);

  const toggleTheme = useCallback((theme: string) => {
    setForm((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  }, []);

  const handleClear = () => {
    clearDraft();
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  // Gera o texto sintético para next_session_plan (compatibilidade com Agenda/ficha)
  const buildNextSessionSynthetic = (f: FormState): string => {
    const parts: string[] = [];
    if (f.next_objetivo.trim()) parts.push(`Objetivo: ${f.next_objetivo.trim()}`);
    if (f.next_retomar.trim()) parts.push(`Retomar: ${f.next_retomar.trim()}`);
    if (f.next_tecnicas.length) parts.push(`Técnicas: ${f.next_tecnicas.join(", ")}`);
    if (f.next_observacoes.trim()) parts.push(`Obs: ${f.next_observacoes.trim()}`);
    return parts.join("\n\n");
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.patient_id) {
      toast.error("Selecione um paciente.");
      return;
    }
    // Bloqueia salvar quando há empate de horário em sessões futuras
    const hasPlanContentEarly =
      form.next_objetivo.trim() ||
      form.next_retomar.trim() ||
      form.next_observacoes.trim() ||
      form.next_tecnicas.length > 0 ||
      form.next_meta_id ||
      form.next_scheduled_at;
    if (ambiguousNext.length > 1 && hasPlanContentEarly) {
      setAmbiguousHighlight(true);
      setTimeout(() => setAmbiguousHighlight(false), 2400);
      requestAnimationFrame(() => {
        ambiguousRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      toast.error("Escolha a qual sessão futura este planejamento deve ser vinculado antes de salvar.");
      return;
    }

    setSaving(true);


    // 1) Preserva compatibilidade: gera texto sintético para o campo antigo,
    // apenas quando o bloco "Próxima sessão" foi preenchido.
    const synthetic = buildNextSessionSynthetic(form);
    const nextSessionPlanText = synthetic || form.next_session_plan;

    const payload = {
      user_id: user.id,
      patient_id: form.patient_id,
      session_id: form.session_id,
      session_date: form.session_date,
      session_number: form.session_number ? Number(form.session_number) : null,
      modality: form.modality,
      duration_minutes: form.duration_minutes,
      chief_complaint: form.chief_complaint,
      themes: form.themes,
      clinical_observations: form.clinical_observations,
      next_session_plan: nextSessionPlanText,
      engagement: form.engagement,
      risk_indicator: form.risk_indicator,
      private_notes: form.private_notes,
      plan_id: form.plan_id,
    };

    const { error } = editingId
      ? await supabase.from("session_records").update(payload).eq("id", editingId)
      : await supabase.from("session_records").insert(payload);

    if (error) {
      setSaving(false);
      toast.error("Erro ao salvar registro.");
      console.error(error);
      return;
    }

    // 2) Resolver / atualizar a sessão-alvo da "próxima sessão"
    const uid = user.id;
    const pid = form.patient_id;
    let targetSessionId: string | null = nextSessionId;
    try {
      if (form.next_scheduled_at) {
        const iso = new Date(form.next_scheduled_at).toISOString();
        if (targetSessionId) {
          await supabase
            .from("sessions")
            .update({ scheduled_at: iso, status: "scheduled" })
            .eq("id", targetSessionId)
            .eq("user_id", uid);
        } else {
          const { data: created } = await supabase
            .from("sessions")
            .insert({
              user_id: uid,
              patient_id: pid,
              scheduled_at: iso,
              duration_minutes: form.duration_minutes || 50,
              modality: form.modality || "presencial",
              status: "scheduled",
              session_type: "clinical",
            })
            .select("id")
            .single();
          if (created?.id) targetSessionId = created.id;
        }
      }
    } catch (e) {
      console.error("Erro ao atualizar Agenda:", e);
      toast.error("Registro salvo, mas houve um problema ao atualizar a Agenda.");
    }

    // 3) Upsert do planejamento em session_plans (somente se houver algum campo preenchido)
    const hasPlanContent =
      form.next_objetivo.trim() ||
      form.next_retomar.trim() ||
      form.next_observacoes.trim() ||
      form.next_tecnicas.length > 0 ||
      form.next_meta_id;
    if (hasPlanContent) {
      try {
        // Tenta encontrar um session_plan existente para reutilizar
        let existingPlanId: string | null = null;
        if (targetSessionId) {
          const { data: sp } = await supabase
            .from("session_plans")
            .select("id")
            .eq("session_id", targetSessionId)
            .maybeSingle();
          existingPlanId = sp?.id ?? null;
        }
        const spPayload = {
          user_id: uid,
          patient_id: pid,
          session_id: targetSessionId,
          objetivo: form.next_objetivo,
          retomar: form.next_retomar,
          tecnicas: form.next_tecnicas,
          observacoes: form.next_observacoes,
          meta_id: form.next_meta_id,
        };
        if (existingPlanId) {
          await supabase.from("session_plans").update(spPayload).eq("id", existingPlanId);
        } else {
          await supabase.from("session_plans").insert(spPayload);
        }
      } catch (e) {
        console.error("Erro ao salvar planejamento:", e);
        toast.error("Registro salvo, mas houve um problema ao salvar o planejamento da próxima sessão.");
      }
    }

    setSaving(false);
    toast.success(editingId ? "Registro atualizado." : "Registro salvo com sucesso.");
    clearDraft();
    const keepPatient = form.patient_id;

    // 4) Verificar se existe Plano Terapêutico ativo — se não, abrir diálogo
    const { data: activePlanRow } = await supabase
      .from("treatment_plans")
      .select("id, status")
      .eq("patient_id", pid)
      .eq("user_id", uid)
      .eq("status", "ativo")
      .maybeSingle();

    if (!editingId && !activePlanRow) {
      const metaDesc = form.next_meta_id
        ? planGoals.find((g) => g.id === form.next_meta_id)?.descricao ?? null
        : null;
      setNoPlanContext({
        patientId: pid,
        objetivo: form.next_objetivo,
        metaId: form.next_meta_id,
        metaDescricao: metaDesc,
        tecnicas: [...form.next_tecnicas],
      });
      setNoPlanDialogOpen(true);
      // Mantém a página até a psicóloga decidir; ao fechar, seguimos o fluxo abaixo
      return;
    }

    // 5) Fluxo padrão: voltar para a ficha se veio de lá
    const cameFromPatient = !!searchParams.get("patient");
    if (cameFromPatient && !editingId && keepPatient) {
      navigate(`/app/pacientes?patientId=${keepPatient}&tab=sessions`, { replace: true });
      return;
    }

    // Mantém o paciente selecionado — reset apenas dos campos do registro,
    // conforme fluxo integrado com o Plano de Tratamento.
    setForm({ ...emptyForm, patient_id: keepPatient });
    setEditingId(null);
    await preserveScroll(() => loadRecords());
    if (keepPatient && user) {
      loadActivePlan(keepPatient, user.id);
    }
  };

  // Cria um Plano Terapêutico Rascunho a partir do bloco "Próxima sessão"
  const handleCreateDraftPlan = async () => {
    if (!user || !noPlanContext) return;
    setCreatingDraftPlan(true);
    const uid = user.id;
    const pid = noPlanContext.patientId;
    try {
      // 1) Cria o treatment_plan em rascunho
      const { data: plan, error: planErr } = await supabase
        .from("treatment_plans")
        .insert({
          user_id: uid,
          patient_id: pid,
          status: "rascunho",
          conceitualizacao: noPlanContext.objetivo || "",
        })
        .select("id")
        .single();
      if (planErr) throw planErr;

      // 2) Meta vinculada — se o usuário selecionou uma meta que já existe, mantemos.
      //    Se selecionou uma que não existe (por qualquer motivo), cria uma nova.
      if (noPlanContext.metaDescricao) {
        const { data: existingGoal } = noPlanContext.metaId
          ? await supabase.from("treatment_goals").select("id").eq("id", noPlanContext.metaId).maybeSingle()
          : { data: null } as any;
        if (!existingGoal) {
          await supabase.from("treatment_goals").insert({
            user_id: uid,
            patient_id: pid,
            tipo: "geral",
            descricao: noPlanContext.metaDescricao,
            ordem: 0,
          });
        }
      }

      // 3) Técnicas previstas
      if (noPlanContext.tecnicas.length) {
        const rows = noPlanContext.tecnicas
          .filter((t) => t.trim())
          .map((nome) => ({ user_id: uid, patient_id: pid, nome }));
        if (rows.length) {
          await supabase.from("treatment_techniques").insert(rows);
        }
      }

      toast.success("Plano criado como Rascunho — revise antes de ativar.");
      setNoPlanDialogOpen(false);
      setNoPlanContext(null);
      navigate(`/app/plano-tratamento?patient=${pid}`);
    } catch (e) {
      console.error("Erro ao criar plano:", e);
      toast.error("Não foi possível criar o Plano Terapêutico.");
    } finally {
      setCreatingDraftPlan(false);
    }
  };

  // "Depois" — apenas segue o fluxo padrão pós-salvamento
  const handleSkipDraftPlan = async () => {
    setNoPlanDialogOpen(false);
    const keepPatient = noPlanContext?.patientId ?? form.patient_id;
    setNoPlanContext(null);

    const cameFromPatient = !!searchParams.get("patient");
    if (cameFromPatient && keepPatient) {
      navigate(`/app/pacientes?patientId=${keepPatient}&tab=sessions`, { replace: true });
      return;
    }

    setForm({ ...emptyForm, patient_id: keepPatient });
    setEditingId(null);
    await preserveScroll(() => loadRecords());
    if (keepPatient && user) {
      loadActivePlan(keepPatient, user.id);
    }
  };


  const handlePolish = async () => {
    const hasText = form.chief_complaint || form.clinical_observations || form.next_session_plan || form.private_notes;
    if (!hasText) {
      toast.error("Preencha pelo menos um campo de texto antes de usar a IA.");
      return;
    }

    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-session-text", {
        body: {
          chief_complaint: form.chief_complaint,
          clinical_observations: form.clinical_observations,
          next_session_plan: form.next_session_plan,
          private_notes: form.private_notes,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const result = data?.result;
      if (result) {
        setForm((prev) => ({
          ...prev,
          chief_complaint: result.chief_complaint ?? prev.chief_complaint,
          clinical_observations: result.clinical_observations ?? prev.clinical_observations,
          next_session_plan: result.next_session_plan ?? prev.next_session_plan,
          private_notes: result.private_notes ?? prev.private_notes,
        }));
        toast.success("Textos revisados pela IA com sucesso.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao processar com IA.");
    } finally {
      setPolishing(false);
    }
  };

  const chiefComplaintRef = useRef<HTMLTextAreaElement | null>(null);
  const heroFormRef = useRef<HTMLElement | null>(null);

  const openEdit = (r: SavedRecord) => {
    setEditingId(r.id);
    setDraftRestored(false);
    setForm({
      ...emptyForm,
      patient_id: r.patient_id,
      session_id: (r as any).session_id ?? null,
      session_date: r.session_date,
      session_number: r.session_number?.toString() ?? "",
      modality: r.modality,
      duration_minutes: r.duration_minutes,
      chief_complaint: r.chief_complaint ?? "",
      themes: r.themes ?? [],
      clinical_observations: r.clinical_observations ?? "",
      next_session_plan: r.next_session_plan ?? "",
      engagement: r.engagement ?? 3,
      risk_indicator: r.risk_indicator ?? "none",
      private_notes: r.private_notes ?? "",
      plan_id: (r as any).plan_id ?? null,
    });
    // Make sure the patient group is expanded so the highlight stays visible
    setExpandedPatients((prev) => ({ ...prev, [r.patient_id]: true }));
    // Scroll the form into view and focus the first editable field
    requestAnimationFrame(() => {
      heroFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => chiefComplaintRef.current?.focus({ preventScroll: true }), 350);
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro de sessão?")) return;
    const { error } = await supabase.from("session_records").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir.");
      return;
    }
    toast.success("Registro excluído.");
    if (editingId === id) handleClear();
    await preserveScroll(() => loadRecords());
  };

  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "—";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  const selectedPatient = patients.find((p) => p.id === form.patient_id);
  const patientRecords = form.patient_id
    ? records.filter((r) => r.patient_id === form.patient_id)
    : [];
  const lastSessionDate = patientRecords[0]?.session_date;

  const filteredRecords = records.filter((r) => {
    if (historyFilter && historyFilter !== "all" && r.patient_id !== historyFilter) return false;
    if (filterModality !== "all" && r.modality !== filterModality) return false;
    if (filterFrom && r.session_date < filterFrom) return false;
    if (filterTo && r.session_date > filterTo) return false;
    return true;
  });

  const hasActiveFilters =
    (historyFilter && historyFilter !== "all") ||
    filterModality !== "all" ||
    !!filterFrom ||
    !!filterTo;

  const clearFilters = () => {
    setHistoryFilter("");
    setFilterFrom("");
    setFilterTo("");
    setFilterModality("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const SectionHeader = ({
    n,
    icon: Icon,
    title,
    subtitle,
    sectionKey,
    color = "#534AB7",
  }: {
    n?: number;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    sectionKey?: string;
    color?: string;
  }) => {
    const collapsible = compactMode && !!sectionKey;
    const open = sectionKey ? isOpen(sectionKey) : true;
    const content = (
      <div className="flex items-start gap-3 w-full">
        <div
          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {n != null ? (
            <span className="text-[11px] font-bold leading-none">{n}</span>
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 pt-0 flex-1 text-left">
          <h2 className="font-display font-bold leading-tight" style={{ fontSize: 15, color: "#1A1A2E" }}>
            {title}
          </h2>
          {subtitle && <p className="mt-0.5" style={{ fontSize: 12, color: "#6B7280" }}>{subtitle}</p>}
        </div>
        {collapsible && (
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform shrink-0 mt-1",
              open && "rotate-180",
            )}
          />
        )}
      </div>
    );
    if (collapsible && sectionKey) {
      return (
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={cn("w-full mb-0 rounded-xl -m-1 p-1 hover:bg-muted/30 transition-colors", open && "mb-4")}
          aria-expanded={open}
        >
          {content}
        </button>
      );
    }
    return <div className="mb-4">{content}</div>;
  };


  // Hub view: when no patient is selected and not editing, show the patient list
  if (!form.patient_id && !editingId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-accent/15 text-accent">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Registro de Sessão</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um paciente para registrar a sessão
            </p>
          </div>
        </div>
        <PageIntro description="Onde você documenta cada sessão — queixa, intervenção, evolução e plano para a próxima. Boas notas sustentam o raciocínio clínico e protegem a continuidade do tratamento." />
        <RegistroSessaoHub onSelectPatient={(id) => setForm((f) => ({ ...f, patient_id: id }))} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5" style={{ backgroundColor: "#F7F6F3", minHeight: "100%" }}>
      <HelpCard
        id="registro-sessao"
        title="Registro de Sessão"
        description="Registre os principais acontecimentos da sessão, intervenções realizadas e planeje a próxima sessão. Este é o único local onde o planejamento da próxima sessão é editado."
        sections={[
          { label: "Quando usar", content: "Imediatamente após cada atendimento, para não perder observações clínicas relevantes." },
          { label: "Conexões", content: "Puxa o Plano Terapêutico ativo do paciente e devolve o planejamento da próxima sessão para lá. Marca a sessão como registrada na Agenda." },
        ]}
      />
      {/* Topbar */}
      <div
        className="px-5 py-4"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => { handleClear(); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline mb-1"
              style={{ color: "#534AB7" }}
            >
              <ArrowLeft className="h-3 w-3" /> Voltar à lista
            </button>
            <h1
              className="font-display leading-tight"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "#1A1A2E" }}
            >
              Registro de Sessão
            </h1>
            <p className="mt-1" style={{ fontSize: 13, color: "#6B7280" }}>
              {editingId ? "Editando registro existente." : "Documente os dados clínicos da sessão realizada."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastSavedAt && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1"
                style={{ backgroundColor: "#EAF3DE", color: "#2D6A4F", borderRadius: 20, fontSize: 11, fontWeight: 600 }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2D6A4F" }} />
                Salvo {format(lastSavedAt, "HH:mm")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setCompactMode((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium hover:bg-muted/40 transition-colors"
              style={{ border: "1px solid #E5E7EB", borderRadius: 8, color: "#6B7280" }}
              aria-pressed={compactMode}
            >
              {compactMode ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              {compactMode ? "Modo expandido" : "Modo compacto"}
            </button>
          </div>
        </div>
      </div>

      {/* Draft restored banner */}
      {draftRestored && !editingId && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: "#EEEDFE", borderLeft: "3px solid #534AB7", borderRadius: 10 }}
        >
          <span style={{ color: "#3C3489", fontWeight: 500, fontSize: 13 }}>
            Rascunho recuperado. Continue de onde parou.
          </span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setForm({ ...emptyForm });
            }}
            className="ml-3 flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-white/60 rounded-md transition-colors"
            style={{ color: "#534AB7" }}
          >
            <X className="h-3 w-3" />
            Descartar
          </button>
        </div>
      )}

      {/* ── Hero do paciente ── */}
      <section
        ref={heroFormRef}
        className="p-5 scroll-mt-4"
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          borderLeft: "3px solid #534AB7",
        }}
      >

        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center text-base font-display font-bold"
            style={{ borderRadius: "50%", backgroundColor: "#EEEDFE", color: "#534AB7", fontWeight: 700 }}
          >
            {selectedPatient ? getInitials(selectedPatient.full_name) : <User className="h-6 w-6" />}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="uppercase"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280" }}
              >
                Paciente
              </span>
              {editingId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground font-medium">
                  editando
                </span>
              )}
            </div>

            <Select
              value={form.patient_id}
              onValueChange={(v) => setForm({ ...form, patient_id: v })}
            >
              <SelectTrigger
                className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 font-display hover:opacity-80 transition-opacity [&>svg]:opacity-50"
                style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}
              >
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPatient && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: 12, color: "#6B7280" }}>
                <span className="inline-flex items-center gap-1">
                  <History className="h-3.5 w-3.5" />
                  {patientRecords.length} {patientRecords.length === 1 ? "sessão registrada" : "sessões registradas"}
                </span>
                {lastSessionDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Última em {format(new Date(lastSessionDate), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Linha rápida: data / nº / modalidade / duração */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
          <div className="space-y-1">
            <Label className="uppercase flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#6B7280" }}>
              <CalendarDays className="h-3 w-3" /> Data
            </Label>
            <Input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
              className="h-9"
              style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB" }}
            />
          </div>
          <div className="space-y-1">
            <Label className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#6B7280" }}>
              Sessão nº
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="—"
              value={form.session_number}
              onChange={(e) => setForm({ ...form, session_number: e.target.value })}
              className="h-9"
              style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB" }}
            />
          </div>
          <div className="space-y-1">
            <Label className="uppercase flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#6B7280" }}>
              {form.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              Modalidade
            </Label>
            <Select
              value={form.modality}
              onValueChange={(v) => setForm({ ...form, modality: v })}
            >
              <SelectTrigger className="h-9" style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="uppercase flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#6B7280" }}>
              <Clock className="h-3 w-3" /> Duração (min)
            </Label>
            <Input
              type="number"
              min="10"
              max="480"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              className="h-9"
              style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB" }}
            />
          </div>
        </div>

      </section>

      {/* Plano de Tratamento Ativo — movido para depois do Registro Clínico */}

      {/* Drawer com o Plano de Tratamento — atualizar sem sair da tela */}
      <Sheet
        open={planDrawerOpen}
        onOpenChange={(o) => {
          setPlanDrawerOpen(o);
          if (!o && form.patient_id && user) {
            loadActivePlan(form.patient_id, user.id);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
          <SheetHeader className="px-5 py-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: "#534AB7" }} />
              Plano de Tratamento
            </SheetTitle>
            <SheetDescription className="text-xs">
              Edite o plano sem sair do Registro de Sessão. Ao fechar, o card acima será atualizado.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {form.patient_id && (
              <iframe
                title="Plano de Tratamento"
                src={`/app/plano-tratamento?patient=${form.patient_id}&embed=1`}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>





      {/* ── Seção 1: Estado do Paciente ── */}
      <section
        className={cn("transition-shadow hover:shadow-md", compactMode && !isOpen("estado") ? "p-3" : "p-5 space-y-4")}
        style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: "3px solid #534AB7" }}
      >
        <SectionHeader n={1} icon={Stethoscope} title="Estado do paciente" subtitle="O que trouxe hoje" sectionKey="estado" color="#534AB7" />
        {isOpen("estado") && (
          <div className="space-y-2">
            <Label>Queixa principal / Tema trazido</Label>
            <Textarea
              ref={chiefComplaintRef}
              rows={3}
              placeholder="Descreva a queixa ou tema central apresentado pelo paciente nesta sessão..."
              value={form.chief_complaint}
              onChange={(e) =>
                setForm({ ...form, chief_complaint: e.target.value })
              }
              style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
            />
          </div>
        )}
      </section>


      {/* ── Seção 2: Conteúdo da Sessão ── */}
      <section
        className={cn("transition-shadow hover:shadow-md", compactMode && !isOpen("conteudo") ? "p-3" : "p-5 space-y-4")}
        style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: "3px solid #B8860B" }}
      >
        <SectionHeader n={2} icon={FileText} title="Conteúdo da sessão" subtitle="Temas, observações e combinados" sectionKey="conteudo" color="#B8860B" />
        {isOpen("conteudo") && (
          <>
            <div className="space-y-2">
              <Label>Temas abordados</Label>
              <div className="flex flex-wrap gap-2">
                {THEME_CHIPS.map((theme) => {
                  const selected = form.themes.includes(theme);
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => toggleTheme(theme)}
                      className="px-3 py-1 transition-colors"
                      style={
                        selected
                          ? { backgroundColor: "#EEEDFE", color: "#534AB7", border: "1px solid #AFA9EC", borderRadius: 6, fontSize: 13, fontWeight: 600 }
                          : { backgroundColor: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 13, fontWeight: 500 }
                      }
                    >
                      {theme}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações clínicas</Label>
              <Textarea
                rows={4}
                placeholder="Registre observações relevantes sobre o conteúdo da sessão..."
                value={form.clinical_observations}
                onChange={(e) =>
                  setForm({ ...form, clinical_observations: e.target.value })
                }
                style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
              />
            </div>

            {/* Planejamento próxima sessão e blocos associados — movidos para depois do Registro Clínico */}


          </>
        )}
      </section>



      {/* ── Seção 3: Avaliação do Terapeuta ── */}
      <section
        className={cn("transition-shadow hover:shadow-md", compactMode && !isOpen("avaliacao") ? "p-3" : "p-5 space-y-4")}
        style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: "3px solid #2D6A4F" }}
      >
        <SectionHeader n={3} icon={ClipboardList} title="Avaliação do terapeuta" subtitle="Engajamento, risco e notas privadas" sectionKey="avaliacao" color="#2D6A4F" />
        {isOpen("avaliacao") && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Engajamento do paciente</Label>
                <span className="font-display font-semibold" style={{ fontSize: 12, color: "#534AB7", fontWeight: 700 }}>
                  {ENGAGEMENT_LABELS[form.engagement - 1]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => {
                  const isCurrent = form.engagement === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setForm({ ...form, engagement: level })}
                      className="flex-1 h-10 transition-colors"
                      style={
                        isCurrent
                          ? { backgroundColor: "#534AB7", color: "#FFFFFF", border: "1px solid #534AB7", borderRadius: 8, fontSize: 14, fontWeight: 700 }
                          : { backgroundColor: "#FFFFFF", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, fontWeight: 600 }
                      }
                      aria-label={`Engajamento nível ${level}`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>


            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Indicador de risco
              </Label>
              <Select
                value={form.risk_indicator}
                onValueChange={(v) => setForm({ ...form, risk_indicator: v })}
              >
                <SelectTrigger
                  className={cn(
                    form.risk_indicator === "high" &&
                      "border-destructive text-destructive",
                    form.risk_indicator === "moderate" &&
                      "border-amber-500 text-amber-700"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas privadas do terapeuta</Label>
              <Textarea
                rows={3}
                placeholder="Anotações pessoais que não fazem parte do prontuário formal..."
                value={form.private_notes}
                onChange={(e) =>
                  setForm({ ...form, private_notes: e.target.value })
                }
              />
            </div>
          </>
        )}
      </section>

      {/* ── Plano de Tratamento Ativo (consulta) — após o Registro Clínico ── */}
      {form.patient_id && activePlan.loaded && (
        <section
          className="p-4 sm:p-5"
          style={{
            backgroundColor: "#EEEDFE",
            borderLeft: "3px solid #534AB7",
            borderRadius: "10px",
          }}
        >
          {!activePlan.plan_id ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: "#534AB7" }} />
                <div>
                  <div
                    className="uppercase"
                    style={{ color: "#534AB7", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em" }}
                  >
                    Sem plano
                  </div>
                  <p className="text-sm text-foreground mt-0.5">
                    Nenhum plano ativo para este paciente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "#534AB7" }}
              >
                Criar plano <PencilIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-4 w-4" style={{ color: "#534AB7" }} />
                  <div
                    className="uppercase"
                    style={{ color: "#534AB7", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em" }}
                  >
                    Plano Terapêutico Ativo
                  </div>
                  {planLoadedIntoForm && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#534AB7]/30 text-[#534AB7] font-medium">
                      carregado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanPanelCollapsed((v) => !v)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/60 transition-colors"
                    aria-label={planPanelCollapsed ? "Expandir" : "Recolher"}
                    style={{ color: "#534AB7" }}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", !planPanelCollapsed && "rotate-180")} />
                  </button>
                </div>
              </div>

              {!planPanelCollapsed && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm mt-3">
                    {activePlan.objetivo && (
                      <div>
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Objetivo terapêutico atual
                        </span>
                        <p className="whitespace-pre-wrap text-foreground mt-0.5">{activePlan.objetivo}</p>
                      </div>
                    )}
                    {activePlan.meta_descricao && (
                      <div>
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Meta vinculada à próxima sessão
                        </span>
                        <p className="whitespace-pre-wrap text-foreground mt-0.5">{activePlan.meta_descricao}</p>
                      </div>
                    )}
                    {activePlan.tecnicas.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Técnicas planejadas
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {activePlan.tecnicas.map((t) => (
                            <span
                              key={t}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-white font-medium"
                              style={{ border: "1px solid #534AB7", color: "#534AB7" }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {activePlan.retomar && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Retomar da sessão anterior
                        </span>
                        <p className="whitespace-pre-wrap text-foreground mt-0.5">{activePlan.retomar}</p>
                      </div>
                    )}
                    {activePlan.goals.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Objetivos terapêuticos ativos
                        </span>
                        <ul className="mt-1 space-y-0.5 text-sm text-foreground list-disc list-inside">
                          {activePlan.goals.slice(0, 5).map((g, i) => (
                            <li key={i} className="whitespace-pre-wrap">{g.descricao}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activePlan.pending_tasks.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-semibold flex items-center gap-1" style={{ color: "#534AB7" }}>
                          <CheckSquare className="h-3 w-3" /> Tarefas pendentes ({activePlan.pending_tasks.length})
                        </span>
                        <ul className="mt-1 space-y-0.5 text-sm text-foreground list-disc list-inside">
                          {activePlan.pending_tasks.slice(0, 5).map((t) => (
                            <li key={t.id} className="whitespace-pre-wrap">{t.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activePlan.next_revision && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-semibold" style={{ color: "#534AB7" }}>
                          Próxima revisão · {format(new Date(activePlan.next_revision.data), "dd/MM/yyyy")}
                        </span>
                        <p className="whitespace-pre-wrap text-foreground mt-0.5 line-clamp-2">{activePlan.next_revision.descricao}</p>
                      </div>
                    )}
                    {!activePlan.objetivo && !activePlan.meta_descricao && !activePlan.tecnicas.length && !activePlan.retomar && !activePlan.goals.length && !activePlan.pending_tasks.length && (
                      <p className="sm:col-span-2 text-sm text-muted-foreground italic">
                        Plano ativo sem planejamento para a próxima sessão.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#534AB7]/15">
                    <button
                      type="button"
                      onClick={applyPlanningToForm}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: "#534AB7", fontWeight: 600 }}
                    >
                      Carregar no registro
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm bg-white hover:bg-white/80 transition-colors"
                      style={{ border: "1px solid #534AB7", color: "#534AB7", fontWeight: 600 }}
                    >
                      <PencilIcon className="h-3.5 w-3.5" /> Abrir Plano Terapêutico
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Planejamento da Próxima Sessão ── */}
      {form.patient_id && (
        <section
          className="p-5 space-y-4"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: "3px solid #B8860B" }}
        >
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "#B8860B" }} />
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">Planejamento da Próxima Sessão</h3>
              <p className="text-xs text-muted-foreground">Combine agora o objetivo e as técnicas da próxima sessão do paciente.</p>
            </div>
          </div>

          {/* Planejamento trazido da sessão anterior (read-only) */}
          {broughtPlanning && (
            <section
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: "#E5E7EB", background: "#F5F3FF" }}
            >
              <h3 className="font-display text-sm font-semibold" style={{ color: "#1A1A2E" }}>
                Planejamento trazido da sessão anterior
              </h3>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Definido no registro da sessão anterior. Use como referência para conduzir esta sessão.
              </p>
              {broughtPlanning.meta_descricao && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Meta vinculada</p>
                  <p className="text-sm text-foreground">{broughtPlanning.meta_descricao}</p>
                </div>
              )}
              {broughtPlanning.objetivo && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Objetivo</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{broughtPlanning.objetivo}</p>
                </div>
              )}
              {broughtPlanning.retomar && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Retomar / Continuidade</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{broughtPlanning.retomar}</p>
                </div>
              )}
              {broughtPlanning.tecnicas.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Técnicas previstas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {broughtPlanning.tecnicas.map((t) => (
                      <span key={t} className="text-xs px-2.5 py-0.5 rounded-full border" style={{ background: "#fff", borderColor: "#E5E7EB", color: "#1A1A2E" }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {broughtPlanning.observacoes && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{broughtPlanning.observacoes}</p>
                </div>
              )}
            </section>
          )}

          {/* Empate: duas sessões futuras no mesmo horário — psicóloga escolhe explicitamente */}
          {ambiguousNext.length > 1 && (
            <section
              ref={ambiguousRef as any}
              className={cn(
                "rounded-lg border-2 p-4 space-y-4 transition-all scroll-mt-24",
                ambiguousHighlight && "ring-4 ring-amber-400/60 animate-pulse"
              )}
              style={{ borderColor: "#F59E0B", background: "#FFFBEB" }}
              aria-label="Seleção obrigatória de sessão-alvo"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#B45309" }} />
                <div className="flex-1">
                  <h3 className="font-display text-base font-semibold" style={{ color: "#78350F" }}>
                    Escolha a qual sessão vincular este planejamento
                  </h3>
                  <p className="text-xs text-[#78350F]/90 mt-1">
                    Existem <strong>{ambiguousNext.length} sessões futuras</strong> deste paciente no mesmo horário.
                    Para evitar vincular ao registro errado, selecione abaixo a sessão-alvo antes de salvar.
                    O vínculo é feito pelo ID da sessão — não pela data.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {ambiguousNext.map((r, idx) => {
                  const picked = ambiguousPick === r.id;
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-start gap-3 rounded-md border-2 bg-white p-3 cursor-pointer transition-colors",
                        picked ? "border-[#B45309] bg-amber-50" : "border-[#FDE68A] hover:border-[#F59E0B]"
                      )}
                    >
                      <input
                        type="radio"
                        name="ambiguous-next"
                        className="mt-1"
                        checked={picked}
                        onChange={() => setAmbiguousPick(r.id)}
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-[11px] font-bold text-[#78350F]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-[#1A1A2E]">
                            {format(new Date(r.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.modality ?? "—"} · {r.duration_minutes ?? 50} min
                          {r.created_at && <> · criada em {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</>}
                        </div>
                        {r.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{r.notes}</div>}
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">ID: {r.id.slice(0, 8)}…</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  disabled={!ambiguousPick}
                  onClick={() => {
                    if (ambiguousPick) {
                      chooseNextSession(ambiguousPick);
                      setAmbiguousPick(null);
                      toast.success("Sessão-alvo vinculada. Agora você pode preencher o planejamento.");
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity",
                    ambiguousPick ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
                  )}
                  style={{ backgroundColor: "#B45309" }}
                >
                  Vincular sessão selecionada
                </button>
              </div>
            </section>
          )}

          <div
            id="proxima-sessao"
            ref={proximaSessaoRef as any}
            className={cn(ambiguousNext.length > 1 && "opacity-50 pointer-events-none select-none")}
            aria-disabled={ambiguousNext.length > 1}
          >
            <SessionPlanningForm
              value={{
                next_scheduled_at: form.next_scheduled_at,
                next_objetivo: form.next_objetivo,
                next_retomar: form.next_retomar,
                next_meta_id: form.next_meta_id,
                next_tecnicas: form.next_tecnicas,
                next_observacoes: form.next_observacoes,
              }}
              onChange={(patch) => setForm({ ...form, ...patch })}
              planGoals={planGoals}
              planTechniques={planTechniques}
              scheduledAtLocked={!!nextSessionId}
              helperText={
                ambiguousNext.length > 1
                  ? "Selecione acima a sessão-alvo antes de preencher o planejamento."
                  : nextSessionId
                    ? "Este planejamento fica vinculado à próxima sessão já agendada do paciente e aparece automaticamente quando ela for aberta."
                    : "Sem próxima sessão agendada. O planejamento fica salvo como pendente e será vinculado quando você agendar."
              }
            />
          </div>

        </section>
      )}

      {/* ── Plano entre Sessões ── */}
      {form.patient_id && form.session_id && (
        <section
          className="p-5 space-y-4"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: "3px solid #3D5C35" }}
        >
          <div className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4" style={{ color: "#3D5C35" }} />
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">Plano entre Sessões</h3>
              <p className="text-xs text-muted-foreground">Combinados e ações do paciente até a próxima sessão. Opcional.</p>
            </div>
          </div>
          <HomeworkPlanForm
            patientId={form.patient_id}
            sessionId={form.session_id}
            initialTask={homeworkTask}
            hideFooter
            showRecordPicker={false}
            patientName={selectedPatient?.full_name ?? null}
            patientPhone={(selectedPatient as any)?.phone ?? null}
            homeworkToken={(selectedPatient as any)?.homework_token ?? null}
            onSaved={(t) => setHomeworkTask(t)}
          />
        </section>
      )}


      {/* ── Resumo da sessão (revisão rápida) ── */}
      {(() => {
        const hasContent =
          form.patient_id ||
          form.chief_complaint.trim() ||
          form.themes.length > 0 ||
          form.clinical_observations.trim() ||
          form.next_session_plan.trim() ||
          form.private_notes.trim();
        if (!hasContent) return null;

        const alerts: { tone: "danger" | "warn" | "info"; label: string }[] = [];
        if (form.risk_indicator === "high")
          alerts.push({ tone: "danger", label: "Risco alto identificado" });
        if (form.risk_indicator === "moderate")
          alerts.push({ tone: "warn", label: "Risco moderado" });
        if (typeof form.engagement === "number" && form.engagement <= 2)
          alerts.push({ tone: "warn", label: `Engajamento ${ENGAGEMENT_LABELS[form.engagement - 1] ?? form.engagement}` });
        if (!form.patient_id) alerts.push({ tone: "warn", label: "Paciente não selecionado" });
        if (!form.chief_complaint.trim())
          alerts.push({ tone: "info", label: "Queixa principal vazia" });
        if (!form.next_session_plan.trim())
          alerts.push({ tone: "info", label: "Plano da próxima sessão em branco" });

        const toneClass = (t: "danger" | "warn" | "info") =>
          t === "danger"
            ? "bg-destructive/10 text-destructive border-destructive/30"
            : t === "warn"
            ? "bg-amber-100 text-amber-800 border-amber-300"
            : "bg-muted text-muted-foreground border-border";

        const modalityLabel =
          form.modality === "online" ? "Online" : form.modality === "domiciliar" ? "Domiciliar" : "Presencial";
        const dateLabel = (() => {
          try {
            return format(new Date(form.session_date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR });
          } catch {
            return form.session_date;
          }
        })();

        return (
          <section className="rounded-2xl border border-sage/40 bg-gradient-to-br from-sage/10 via-card to-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sage/30 to-accent/10 text-foreground ring-1 ring-sage/30">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground leading-tight">
                  Resumo da sessão
                </h2>
                <p className="text-xs text-muted-foreground">
                  Revise antes de salvar ou enviar para a IA.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paciente</p>
                <p className="font-medium text-foreground truncate">
                  {selectedPatient?.full_name ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sessão</p>
                <p className="font-medium text-foreground">
                  {dateLabel} · {modalityLabel} · {form.duration_minutes}min
                  {form.session_number ? ` · nº ${form.session_number}` : ""}
                </p>
              </div>
              <div className="rounded-xl border bg-card/60 p-3 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Queixa principal</p>
                <p className="text-foreground line-clamp-2">
                  {form.chief_complaint.trim() || <span className="text-muted-foreground italic">não preenchida</span>}
                </p>
              </div>
              {form.themes.length > 0 && (
                <div className="rounded-xl border bg-card/60 p-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Temas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.themes.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-accent/10 text-accent px-2 py-0.5 text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {form.next_session_plan.trim() && (
                <div className="rounded-xl border bg-card/60 p-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plano próxima sessão</p>
                  <p className="text-foreground line-clamp-2">{form.next_session_plan}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Sinais de alerta
              </p>
              {alerts.length === 0 ? (
                <p className="text-sm text-sage font-medium">Tudo certo — nenhum sinal de alerta.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {alerts.map((a, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                        toneClass(a.tone)
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {a.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ── Seção 6: IA — Revisão de texto ── */}
      <section className="relative overflow-hidden rounded-2xl border border-lilac/30 bg-gradient-to-br from-lilac/10 via-card to-accent/5 p-5 space-y-3 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lilac/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lilac/40 to-accent/20 text-foreground ring-1 ring-lilac/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground leading-tight">
                Revisão com IA
              </h2>
              <p className="text-xs text-muted-foreground">
                Ortografia, gramática e clareza — sem alterar o conteúdo clínico.
              </p>
            </div>
          </div>
          <Button
            variant="accent"
            className="w-full mt-4"
            onClick={handlePolish}
            disabled={polishing}
          >
            {polishing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {polishing ? "Revisando..." : "Revisar textos com IA"}
          </Button>
        </div>
      </section>

      {/* ── Ações ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleClear}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {editingId ? "Cancelar edição" : "Limpar"}
        </Button>
        <Button
          variant="accent"
          className="flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {editingId ? "Atualizar registro" : "Salvar registro"}
        </Button>
      </div>

      {/* ── Histórico de registros ── */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
        >
          <h2 className="font-display text-base font-semibold text-foreground">
            Registros salvos{" "}
            <span className="text-muted-foreground font-normal">
              ({filteredRecords.length}
              {hasActiveFilters && filteredRecords.length !== records.length && ` de ${records.length}`})
            </span>
          </h2>
          {showHistory ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {showHistory && (
          <div className="border-t border-border">
            {records.length > 0 && (
              <div className="p-4 pb-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Select value={historyFilter || "all"} onValueChange={(v) => setHistoryFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os pacientes</SelectItem>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterModality} onValueChange={setFilterModality}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas modalidades</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="h-9"
                    placeholder="De"
                    aria-label="Data inicial"
                  />
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="h-9"
                    placeholder="Até"
                    aria-label="Data final"
                  />
                </div>
                {hasActiveFilters && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {filteredRecords.length} {filteredRecords.length === 1 ? "resultado" : "resultados"}
                    </span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" /> Limpar filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum registro salvo ainda. Preencha o formulário acima e clique em "Salvar registro".
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(() => {
                  // Group filtered records by patient
                  const groups = new Map<string, SavedRecord[]>();
                  filteredRecords.forEach((r) => {
                    if (!groups.has(r.patient_id)) groups.set(r.patient_id, []);
                    groups.get(r.patient_id)!.push(r);
                  });
                  const ordered = Array.from(groups.entries()).sort((a, b) =>
                    getPatientName(a[0]).localeCompare(getPatientName(b[0]))
                  );
                  return ordered.map(([patientId, items]) => {
                    const isOpen = !!expandedPatients[patientId];
                    const lastDate = items[0]?.session_date;
                    return (
                      <li key={patientId}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPatients((prev) => ({ ...prev, [patientId]: !prev[patientId] }))
                          }
                          className={cn(
                            "w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left group",
                            isOpen && "bg-muted/20",
                          )}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-lilac/15 text-accent font-display text-sm font-bold ring-1 ring-accent/15 group-hover:ring-accent/30 transition-all">
                            {getInitials(getPatientName(patientId))}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-semibold text-sm text-foreground truncate">
                              {getPatientName(patientId)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {items.length} {items.length === 1 ? "registro" : "registros"}
                              {lastDate && ` · último em ${format(new Date(lastDate), "dd/MM/yyyy")}`}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/12 text-accent shrink-0 ring-1 ring-accent/20">
                            {items.length}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-accent shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-accent transition-colors" />
                          )}
                        </button>

                        {isOpen && (
                          <ul className="bg-muted/10 divide-y divide-border/60 border-t border-border">
                            {items.map((r) => (
                              <li key={r.id}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openEdit(r)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openEdit(r);
                                    }
                                  }}
                                  className={cn(
                                    "p-4 pl-6 transition-colors cursor-pointer focus:outline-none border-l-2",
                                    editingId === r.id
                                      ? "bg-accent/10 border-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.25)]"
                                      : "border-transparent hover:bg-muted/30 focus:bg-muted/30",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(r.session_date), "dd/MM/yyyy")}
                                        </span>
                                        {r.session_number && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                            Sessão {r.session_number}
                                          </span>
                                        )}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                                          {r.modality}
                                        </span>
                                        {editingId === r.id && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/50 text-foreground font-medium">
                                            editando
                                          </span>
                                        )}
                                      </div>
                                      {r.chief_complaint && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          {r.chief_complaint}
                                        </p>
                                      )}
                                      {r.themes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {r.themes.map((t) => (
                                            <span
                                              key={t}
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                            >
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEdit(r)}
                                        title="Editar"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(r.id)}
                                        title="Excluir"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </div>
        )}
      </section>

      <div className="pb-8" />

      <Dialog open={noPlanDialogOpen} onOpenChange={(o) => { if (!o) handleSkipDraftPlan(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Este paciente ainda não tem Plano Terapêutico ativo</DialogTitle>
            <DialogDescription>
              Deseja criar um rascunho agora usando o objetivo, a meta e as técnicas registradas
              no planejamento da próxima sessão? Você poderá revisar e ativar depois.
            </DialogDescription>
          </DialogHeader>
          {noPlanContext && (
            <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/30">
              {noPlanContext.objetivo && (
                <div><span className="font-medium">Objetivo:</span> {noPlanContext.objetivo}</div>
              )}
              {noPlanContext.metaDescricao && (
                <div><span className="font-medium">Meta:</span> {noPlanContext.metaDescricao}</div>
              )}
              {noPlanContext.tecnicas.length > 0 && (
                <div><span className="font-medium">Técnicas:</span> {noPlanContext.tecnicas.join(", ")}</div>
              )}
              {!noPlanContext.objetivo && !noPlanContext.metaDescricao && noPlanContext.tecnicas.length === 0 && (
                <div className="text-muted-foreground">
                  Nenhum campo estruturado preenchido — o rascunho será criado em branco.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipDraftPlan} disabled={creatingDraftPlan}>
              Depois
            </Button>
            <Button variant="accent" onClick={handleCreateDraftPlan} disabled={creatingDraftPlan}>
              {creatingDraftPlan ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Criar rascunho agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default RegistroSessao;
