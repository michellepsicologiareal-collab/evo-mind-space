import { useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, AlertTriangle, Sparkles, ChevronDown, ChevronUp, Pencil, Trash2, X, User, CalendarDays, Clock, Video, MapPin, FileText, ClipboardList, Stethoscope, History, Minimize2, Maximize2, Target, ExternalLink, ArrowLeft } from "lucide-react";
import { RegistroSessaoHub } from "@/components/app/RegistroSessaoHub";
import { Link } from "react-router-dom";
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
};

type FormState = typeof emptyForm;

function hasMeaningfulData(f: FormState): boolean {
  return !!(
    f.patient_id ||
    f.chief_complaint.trim() ||
    f.clinical_observations.trim() ||
    f.next_session_plan.trim() ||
    f.private_notes.trim() ||
    f.themes.length > 0
  );
}

const RegistroSessao = () => {
  const { user } = useAuth();
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
    loaded: boolean;
  }>({ plan_id: null, plan_status: null, objetivo: "", retomar: "", tecnicas: [], observacoes: "", meta_descricao: null, scheduled_at: null, loaded: false });
  const [planPanelCollapsed, setPlanPanelCollapsed] = useState(false);
  const [planLoadedIntoForm, setPlanLoadedIntoForm] = useState(false);

  useEffect(() => {
    if (!user || !form.patient_id) {
      setActivePlan({ plan_id: null, plan_status: null, objetivo: "", retomar: "", tecnicas: [], observacoes: "", meta_descricao: null, scheduled_at: null, loaded: false });
      setPlanPanelCollapsed(false);
      setPlanLoadedIntoForm(false);
      return;
    }
    (async () => {
      // 1. Active treatment plan for this patient
      const { data: tp } = await supabase
        .from("treatment_plans")
        .select("id, status")
        .eq("patient_id", form.patient_id)
        .eq("user_id", user.id)
        .maybeSingle();

      // 2. Next session + plan content
      const { data: ns } = await supabase
        .from("sessions")
        .select("id, scheduled_at")
        .eq("patient_id", form.patient_id)
        .eq("user_id", user.id)
        .gte("scheduled_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .not("status", "in", "(cancelled,no_show)")
        .order("scheduled_at")
        .limit(1)
        .maybeSingle();

      let sp: any = null;
      if (ns?.id) {
        const { data } = await supabase
          .from("session_plans")
          .select("objetivo, retomar, tecnicas, observacoes, meta_id")
          .eq("session_id", ns.id)
          .maybeSingle();
        sp = data;
      }

      let meta_descricao: string | null = null;
      if (sp?.meta_id) {
        const { data: m } = await supabase.from("treatment_goals").select("descricao").eq("id", sp.meta_id).maybeSingle();
        meta_descricao = m?.descricao ?? null;
      }

      setActivePlan({
        plan_id: tp?.id ?? null,
        plan_status: tp?.status ?? null,
        objetivo: sp?.objetivo || "",
        retomar: sp?.retomar || "",
        tecnicas: sp?.tecnicas || [],
        observacoes: sp?.observacoes || "",
        meta_descricao,
        scheduled_at: ns?.scheduled_at ?? null,
        loaded: true,
      });
      setPlanPanelCollapsed(false);
      setPlanLoadedIntoForm(false);
    })();
  }, [user, form.patient_id]);

  const applyPlanningToForm = () => {
    setForm((prev) => {
      const next = { ...prev, plan_id: activePlan.plan_id ?? prev.plan_id };
      // Queixa principal ← meta vinculada (não sobrescreve se já houver texto)
      if (!prev.chief_complaint.trim() && activePlan.meta_descricao) {
        next.chief_complaint = activePlan.meta_descricao;
      }
      // Observações clínicas ← retomar (não sobrescreve)
      if (!prev.clinical_observations.trim() && activePlan.retomar) {
        next.clinical_observations = activePlan.retomar;
      }
      // Temas ← técnicas planejadas (mescla sem duplicar)
      if (activePlan.tecnicas.length) {
        const merged = Array.from(new Set([...prev.themes, ...activePlan.tecnicas]));
        next.themes = merged;
      }
      // next_session_plan permanece em branco para preenchimento
      return next;
    });
    setPlanLoadedIntoForm(true);
    setPlanPanelCollapsed(true);
    toast.success("Plano carregado com sucesso");
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
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flushDraft();
      if (hasMeaningfulData(formRef.current)) e.preventDefault();
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
        .select("id, full_name")
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

  const handleSave = async () => {
    if (!user) return;
    if (!form.patient_id) {
      toast.error("Selecione um paciente.");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      patient_id: form.patient_id,
      session_date: form.session_date,
      session_number: form.session_number ? Number(form.session_number) : null,
      modality: form.modality,
      duration_minutes: form.duration_minutes,
      chief_complaint: form.chief_complaint,
      themes: form.themes,
      clinical_observations: form.clinical_observations,
      next_session_plan: form.next_session_plan,
      engagement: form.engagement,
      risk_indicator: form.risk_indicator,
      private_notes: form.private_notes,
      plan_id: form.plan_id,
    };

    const { error } = editingId
      ? await supabase.from("session_records").update(payload).eq("id", editingId)
      : await supabase.from("session_records").insert(payload);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar registro.");
      console.error(error);
      return;
    }

    toast.success(editingId ? "Registro atualizado." : "Registro salvo com sucesso.");
    clearDraft();
    setForm({ ...emptyForm });
    setEditingId(null);
    loadRecords();
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
      patient_id: r.patient_id,
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
    loadRecords();
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
  }: {
    n?: number;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    sectionKey?: string;
  }) => {
    const collapsible = compactMode && !!sectionKey;
    const open = sectionKey ? isOpen(sectionKey) : true;
    const content = (
      <div className="flex items-start gap-3 w-full">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
          <Icon className="h-4 w-4" />
          {n != null && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow-sm">
              {n}
            </span>
          )}
        </div>
        <div className="min-w-0 pt-0.5 flex-1 text-left">
          <h2 className="font-display text-base font-semibold text-foreground leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
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
            <h1 className="font-display text-2xl font-bold">Registro de Sessão</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um paciente para registrar a sessão
            </p>
          </div>
        </div>
        <RegistroSessaoHub onSelectPatient={(id) => setForm((f) => ({ ...f, patient_id: id }))} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header com brilho sutil */}
      <div className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-br from-card via-card to-accent/8 px-5 py-4 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-lilac/20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => { handleClear(); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar à lista
            </button>
            <span className="text-[10px] uppercase tracking-[0.18em] text-accent/80 font-semibold">
              Prontuário
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight mt-0.5">
              Registro de Sessão
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {editingId ? "Editando registro existente." : "Documente os dados clínicos da sessão realizada."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCompactMode((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                compactMode
                  ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-accent/30",
              )}
              aria-pressed={compactMode}
              title={compactMode ? "Sair do modo compacto" : "Ativar modo compacto"}
            >
              {compactMode ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              {compactMode ? "Modo expandido" : "Modo compacto"}
            </button>
            {lastSavedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/10 px-2.5 py-1 text-[11px] font-medium text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                Salvo {format(lastSavedAt, "HH:mm:ss")}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* Draft restored banner */}
      {draftRestored && !editingId && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <span>Rascunho recuperado. Continue de onde parou.</span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setForm({ ...emptyForm });
            }}
            className="ml-3 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium hover:bg-primary/10 transition-colors"
          >
            <X className="h-3 w-3" />
            Descartar
          </button>
        </div>
      )}

      {/* ── Hero do paciente ── */}
      <section
        ref={heroFormRef}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 shadow-sm scroll-mt-4 transition-all",
          selectedPatient
            ? "border-accent/30 bg-gradient-to-br from-card via-card to-accent/8"
            : "border-dashed border-border bg-card",
        )}
      >
        {selectedPatient && (
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        )}
        <div className="relative flex items-start gap-4">
          <div
            className={cn(
              "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-display font-bold transition-all",
              selectedPatient
                ? "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-lg ring-4 ring-accent/15"
                : "bg-muted text-muted-foreground",
            )}
          >
            {selectedPatient ? getInitials(selectedPatient.full_name) : <User className="h-6 w-6" />}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
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
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 font-display text-xl font-semibold text-foreground hover:text-accent transition-colors [&>svg]:opacity-50">
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
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
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-border/60 pt-4">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Data
            </Label>
            <Input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Sessão nº
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="—"
              value={form.session_number}
              onChange={(e) => setForm({ ...form, session_number: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              {form.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              Modalidade
            </Label>
            <Select
              value={form.modality}
              onValueChange={(v) => setForm({ ...form, modality: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Duração (min)
            </Label>
            <Input
              type="number"
              min="10"
              max="480"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              className="h-9"
            />
          </div>
        </div>
      </section>

      {/* ── Plano de Tratamento Ativo ── */}
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
              <Link
                to={`/app/plano-tratamento?patient=${form.patient_id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "#534AB7" }}
              >
                Criar plano <ExternalLink className="h-3.5 w-3.5" />
              </Link>
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
                    Plano Ativo
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
                    {!activePlan.objetivo && !activePlan.meta_descricao && !activePlan.tecnicas.length && !activePlan.retomar && (
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
                    <Link
                      to={`/app/plano-tratamento?patient=${form.patient_id}`}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm bg-transparent hover:bg-white/60 transition-colors"
                      style={{ border: "1px solid #534AB7", color: "#534AB7", fontWeight: 600 }}
                    >
                      Ver plano completo <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}




      {/* ── Seção 2: Estado do Paciente ── */}
      <section className={cn(
        "rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-accent/20 transition-all",
        compactMode && !isOpen("estado") ? "p-3" : "p-5 space-y-4",
      )}>
        <SectionHeader n={1} icon={Stethoscope} title="Estado do paciente" subtitle="O que trouxe hoje" sectionKey="estado" />
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
            />
          </div>
        )}
      </section>

      {/* ── Seção 3: Conteúdo da Sessão ── */}
      <section className={cn(
        "rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-accent/20 transition-all",
        compactMode && !isOpen("conteudo") ? "p-3" : "p-5 space-y-4",
      )}>
        <SectionHeader n={2} icon={FileText} title="Conteúdo da sessão" subtitle="Temas, observações e combinados" sectionKey="conteudo" />
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
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 hover:-translate-y-0.5",
                        selected
                          ? "bg-gradient-to-br from-accent to-accent/85 text-accent-foreground border-accent shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:border-accent/30 hover:bg-card hover:text-foreground"
                      )}
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
              />
            </div>

            <div className="space-y-2">
              <Label>Combinados para a próxima sessão</Label>
              <Textarea
                rows={2}
                placeholder="Tarefas, exercícios ou combinados com o paciente..."
                value={form.next_session_plan}
                onChange={(e) =>
                  setForm({ ...form, next_session_plan: e.target.value })
                }
              />
            </div>
          </>
        )}
      </section>

      {/* ── Seção 4: Avaliação do Terapeuta ── */}
      <section className={cn(
        "rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-accent/20 transition-all",
        compactMode && !isOpen("avaliacao") ? "p-3" : "p-5 space-y-4",
      )}>
        <SectionHeader n={3} icon={ClipboardList} title="Avaliação do terapeuta" subtitle="Engajamento, risco e notas privadas" sectionKey="avaliacao" />
        {isOpen("avaliacao") && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Engajamento do paciente</Label>
                <span className="text-xs font-display font-semibold text-accent">
                  {ENGAGEMENT_LABELS[form.engagement - 1]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => {
                  const active = form.engagement >= level;
                  const isCurrent = form.engagement === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setForm({ ...form, engagement: level })}
                      className={cn(
                        "flex-1 h-10 rounded-xl text-sm font-semibold transition-all duration-200 relative overflow-hidden",
                        active
                          ? "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-sm"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                        isCurrent && "ring-2 ring-accent/40 ring-offset-2 ring-offset-card scale-[1.04]",
                      )}
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
    </div>
  );
};

export default RegistroSessao;
