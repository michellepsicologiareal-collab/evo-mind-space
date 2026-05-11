import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logClinicalAccess } from "@/utils/auditLog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2, Save, Plus, Trash2, Brain, MessageSquare, ListChecks, BookOpen,
  Sparkles, Copy, ChevronDown, ChevronUp, Pencil, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PlanStatus = "initial" | "in_progress" | "consolidated";

interface TherapyPlan {
  id: string;
  objective: string;
  hypothesis: string;
  interventions: string[];
  homework: string[];
  indicators: string[];
  status: PlanStatus;
}

interface Evolution {
  id: string;
  session_summary: string;
  homework: string;
  created_at: string;
}

const FIVE_SYSTEMS = [
  { key: "environment", label: "Ambiente", placeholder: "Contexto situacional, estressores, relações..." },
  { key: "thoughts", label: "Pensamentos", placeholder: "Pensamentos automáticos, interpretações..." },
  { key: "emotions", label: "Emoções", placeholder: "Emoções predominantes, intensidade..." },
  { key: "behaviors", label: "Comportamentos", placeholder: "Padrões comportamentais, evitações..." },
  { key: "physical_reactions", label: "Reações Físicas", placeholder: "Tensão, sono, apetite, sintomas somáticos..." },
] as const;

type SystemKey = (typeof FIVE_SYSTEMS)[number]["key"];

const STATUS_META: Record<PlanStatus, { label: string; cls: string }> = {
  initial: { label: "Inicial", cls: "bg-muted text-muted-foreground border border-border" },
  in_progress: { label: "Em andamento", cls: "bg-serene/15 text-serene border border-serene/30" },
  consolidated: { label: "Consolidado", cls: "bg-accent/15 text-accent border border-accent/30" },
};

const newPlan = (): TherapyPlan => ({
  id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  objective: "",
  hypothesis: "",
  interventions: [],
  homework: [],
  indicators: [],
  status: "initial",
});

// Migrate legacy goals (`{text, completed}[]`) to TherapyPlan[]
const normalizePlans = (raw: unknown): TherapyPlan[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((g: any) => {
    if (g && typeof g.objective === "string") {
      return {
        id: g.id ?? newPlan().id,
        objective: g.objective ?? "",
        hypothesis: g.hypothesis ?? "",
        interventions: Array.isArray(g.interventions) ? g.interventions : [],
        homework: Array.isArray(g.homework) ? g.homework : [],
        indicators: Array.isArray(g.indicators) ? g.indicators : [],
        status: (["initial", "in_progress", "consolidated"].includes(g.status) ? g.status : "initial") as PlanStatus,
      };
    }
    // Legacy {text, completed}
    return {
      ...newPlan(),
      objective: g?.text ?? "",
      status: g?.completed ? "consolidated" : "initial",
    };
  });
};

// Chip-list editor
const ChipList = ({
  label, items, onChange, placeholder, readOnly,
}: { label: string; items: string[]; onChange: (next: string[]) => void; placeholder: string; readOnly?: boolean }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary/60 border border-border px-2.5 py-1 text-xs text-foreground">
              {it}
              {!readOnly && (
                <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder}
            className="h-9 text-sm"
          />
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const CaseFormulation = ({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulation state
  const [systems, setSystems] = useState<Record<SystemKey, string>>({
    environment: "", thoughts: "", emotions: "", behaviors: "", physical_reactions: "",
  });
  const [coreBeliefs, setCoreBeliefs] = useState("");
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [planSavedAt, setPlanSavedAt] = useState<string | null>(null);

  // Evolutions state
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [evoSummary, setEvoSummary] = useState("");
  const [evoHomework, setEvoHomework] = useState("");
  const [savingEvo, setSavingEvo] = useState(false);
  const [editingEvoId, setEditingEvoId] = useState<string | null>(null);
  const [editEvoSummary, setEditEvoSummary] = useState("");
  const [editEvoHomework, setEditEvoHomework] = useState("");
  const [savingEvoEdit, setSavingEvoEdit] = useState(false);

  // AI organize state
  const [organizing, setOrganizing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const draftKey = `therapy-plan-draft::${patientId}`;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [formRes, evoRes] = await Promise.all([
        supabase.from("case_formulations").select("*").eq("patient_id", patientId).eq("user_id", user.id).maybeSingle(),
        supabase.from("session_evolutions").select("*").eq("patient_id", patientId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);

      if (formRes.data) {
        const f = formRes.data;
        setFormId(f.id);
        setSystems({
          environment: f.environment ?? "",
          thoughts: f.thoughts ?? "",
          emotions: f.emotions ?? "",
          behaviors: f.behaviors ?? "",
          physical_reactions: f.physical_reactions ?? "",
        });
        setCoreBeliefs(f.core_beliefs ?? "");
        setPlans(normalizePlans(f.treatment_goals));
        setPlanSavedAt(f.updated_at ?? null);
      }

      // Restore localStorage draft (overrides DB if present)
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setPlans(normalizePlans(parsed));
        }
      } catch { /* noop */ }

      setEvolutions((evoRes.data as Evolution[]) ?? []);
      setLoading(false);
      hasLoadedRef.current = true;
      if (formRes.data) logClinicalAccess("case_formulation", formRes.data.id, patientId);
    };
    load();
  }, [user, patientId, draftKey]);

  // Auto-save plans to localStorage on every change
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify(plans)); } catch { /* noop */ }
  }, [plans, draftKey]);

  const saveFormulation = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      patient_id: patientId,
      user_id: user.id,
      ...systems,
      core_beliefs: coreBeliefs,
      treatment_goals: JSON.parse(JSON.stringify(plans)),
    };

    if (formId) {
      const { data, error } = await supabase.from("case_formulations").update(payload).eq("id", formId).select("updated_at").single();
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
      setPlanSavedAt(data?.updated_at ?? new Date().toISOString());
    } else {
      const { data, error } = await supabase.from("case_formulations").insert(payload).select("id, updated_at").single();
      if (error) { toast.error("Erro ao criar formulação"); setSaving(false); return; }
      setFormId(data.id);
      setPlanSavedAt(data.updated_at ?? new Date().toISOString());
    }
    try { localStorage.removeItem(draftKey); } catch { /* noop */ }
    toast.success("Plano terapêutico salvo");
    setSaving(false);
  };

  const updatePlan = (id: string, patch: Partial<TherapyPlan>) => {
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const addPlan = () => {
    const p = newPlan();
    setPlans((prev) => [...prev, p]);
    setOpenPlanId(p.id);
  };

  const removePlan = (id: string) => {
    if (!window.confirm("Excluir este objetivo terapêutico?")) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (openPlanId === id) setOpenPlanId(null);
  };

  const saveEvolution = async () => {
    if (!user || (!evoSummary.trim() && !evoHomework.trim())) return;
    setSavingEvo(true);
    const { data, error } = await supabase
      .from("session_evolutions")
      .insert({ patient_id: patientId, user_id: user.id, session_summary: evoSummary.trim(), homework: evoHomework.trim() })
      .select("*").single();
    setSavingEvo(false);
    if (error) { toast.error("Erro ao salvar evolução"); return; }
    setEvolutions((prev) => [data as Evolution, ...prev]);
    setEvoSummary(""); setEvoHomework("");
    toast.success("Evolução registrada");
  };

  const startEditEvo = (evo: Evolution) => {
    setEditingEvoId(evo.id);
    setEditEvoSummary(evo.session_summary ?? "");
    setEditEvoHomework(evo.homework ?? "");
  };

  const cancelEditEvo = () => {
    setEditingEvoId(null);
    setEditEvoSummary("");
    setEditEvoHomework("");
  };

  const saveEditEvo = async () => {
    if (!editingEvoId) return;
    setSavingEvoEdit(true);
    const { error } = await supabase
      .from("session_evolutions")
      .update({ session_summary: editEvoSummary.trim(), homework: editEvoHomework.trim() })
      .eq("id", editingEvoId);
    setSavingEvoEdit(false);
    if (error) { toast.error("Erro ao salvar alteração"); return; }
    setEvolutions((prev) => prev.map((e) => e.id === editingEvoId ? { ...e, session_summary: editEvoSummary.trim(), homework: editEvoHomework.trim() } : e));
    cancelEditEvo();
    toast.success("Alteração salva");
  };

  const deleteEvo = async (id: string) => {
    if (!window.confirm("Excluir este registro de evolução? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("session_evolutions").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setEvolutions((prev) => prev.filter((e) => e.id !== id));
    if (editingEvoId === id) cancelEditEvo();
    toast.success("Registro excluído");
  };

  const organizeNotes = async () => {
    const notes = evoSummary.trim();
    if (!notes) { toast.error("Escreva suas anotações antes de organizar."); return; }
    setOrganizing(true); setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("organize-notes", { body: { notes } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAiResult(data.result);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao organizar notas. Tente novamente.");
    } finally { setOrganizing(false); }
  };

  const copyToEvolution = () => {
    if (!aiResult) return;
    setEvoSummary(aiResult); setAiResult(null);
    toast.success("Texto copiado para a evolução!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="formulation" className="space-y-4">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="formulation" className="text-xs sm:text-sm">
          <Brain className="h-4 w-4 mr-1 hidden sm:inline" /> 5 Sistemas
        </TabsTrigger>
        <TabsTrigger value="goals" className="text-xs sm:text-sm">
          <ListChecks className="h-4 w-4 mr-1 hidden sm:inline" /> Plano Terapêutico
        </TabsTrigger>
        <TabsTrigger value="evolution" className="text-xs sm:text-sm">
          <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" /> Evolução
        </TabsTrigger>
      </TabsList>

      {/* ── 5 Systems + Core Beliefs ── */}
      <TabsContent value="formulation" className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display font-bold text-foreground flex items-center gap-2 mb-1">
            <Brain className="h-4 w-4 text-accent" /> Modelo de 5 Sistemas — Padesky
          </h3>
          <p className="text-xs text-muted-foreground">Formulação cognitivo-comportamental integrada.</p>
        </div>

        {FIVE_SYSTEMS.map((sys) => (
          <div key={sys.key} className="space-y-1.5">
            <Label className="font-semibold text-sm">{sys.label}</Label>
            {readOnly ? (
              <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 min-h-[40px]">{systems[sys.key] || <span className="text-muted-foreground italic">—</span>}</p>
            ) : (
              <Textarea
                rows={3}
                className="min-h-[72px] scroll-mt-24"
                placeholder={sys.placeholder}
                value={systems[sys.key]}
                onChange={(e) => setSystems((prev) => ({ ...prev, [sys.key]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <div className="space-y-1.5 pt-2">
          <Label className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" /> Crenças Nucleares
          </Label>
          <p className="text-xs text-muted-foreground mb-1">Visão de Si, do Mundo e do Futuro</p>
          {readOnly ? (
            <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 min-h-[40px]">{coreBeliefs || <span className="text-muted-foreground italic">—</span>}</p>
          ) : (
            <Textarea
              rows={4}
              className="min-h-[90px] scroll-mt-24 border-accent/30"
              placeholder="Ex.: 'Eu sou incapaz' (Si) · 'O mundo é ameaçador' (Mundo) · 'Nada vai melhorar' (Futuro)"
              value={coreBeliefs}
              onChange={(e) => setCoreBeliefs(e.target.value)}
            />
          )}
        </div>

        {!readOnly && (
          <Button variant="accent" className="min-h-[44px] w-full" onClick={saveFormulation} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Formulação
          </Button>
        )}
      </TabsContent>

      {/* ── Plano Terapêutico ── */}
      <TabsContent value="goals" className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display font-bold text-foreground flex items-center gap-2 mb-1">
            <ListChecks className="h-4 w-4 text-accent" /> Plano Terapêutico
          </h3>
          <p className="text-xs text-muted-foreground">5 Sistemas → Hipóteses → Plano → Evolução</p>
        </div>

        {plans.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum objetivo terapêutico ainda. Adicione o primeiro abaixo.</p>
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => {
              const open = openPlanId === p.id;
              const status = STATUS_META[p.status];
              return (
                <li key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-card">
                  <button
                    type="button"
                    onClick={() => setOpenPlanId(open ? null : p.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.objective || <span className="text-muted-foreground italic font-normal">Sem título</span>}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full", status.cls)}>
                      {status.label}
                    </span>
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {open && (
                    <div className="border-t border-border p-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Objetivo terapêutico</Label>
                        <Input
                          value={p.objective}
                          onChange={(e) => updatePlan(p.id, { objective: e.target.value })}
                          placeholder="Ex.: Reduzir esquiva social"
                          disabled={readOnly}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Hipótese clínica</Label>
                        <Textarea
                          rows={3}
                          value={p.hypothesis}
                          onChange={(e) => updatePlan(p.id, { hypothesis: e.target.value })}
                          placeholder="Formulação que sustenta este objetivo..."
                          disabled={readOnly}
                        />
                      </div>

                      <ChipList
                        label="Intervenções planejadas"
                        items={p.interventions}
                        onChange={(next) => updatePlan(p.id, { interventions: next })}
                        placeholder="Adicionar intervenção e Enter"
                        readOnly={readOnly}
                      />
                      <ChipList
                        label="Tarefas de casa"
                        items={p.homework}
                        onChange={(next) => updatePlan(p.id, { homework: next })}
                        placeholder="Adicionar tarefa e Enter"
                        readOnly={readOnly}
                      />
                      <ChipList
                        label="Indicadores de progresso"
                        items={p.indicators}
                        onChange={(next) => updatePlan(p.id, { indicators: next })}
                        placeholder="Adicionar indicador e Enter"
                        readOnly={readOnly}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/80">Status</Label>
                          <Select
                            value={p.status}
                            onValueChange={(v) => updatePlan(p.id, { status: v as PlanStatus })}
                            disabled={readOnly}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="initial">Inicial</SelectItem>
                              <SelectItem value="in_progress">Em andamento</SelectItem>
                              <SelectItem value="consolidated">Consolidado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:self-end"
                            onClick={() => removePlan(p.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Excluir objetivo
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px] border-dashed border-accent/40 text-accent hover:bg-accent/10"
              onClick={addPlan}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar Objetivo
            </Button>
            <Button variant="accent" className="min-h-[44px] w-full" onClick={saveFormulation} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Plano Terapêutico
            </Button>
          </>
        )}
      </TabsContent>

      {/* ── Session Evolution ── */}
      <TabsContent value="evolution" className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display font-bold text-foreground flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-accent" /> Evolução Diária
          </h3>
          <p className="text-xs text-muted-foreground">Registre o resumo e a tarefa de casa de cada sessão.</p>
        </div>

        {!readOnly && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Anotações da Sessão</Label>
              <Textarea
                rows={5}
                className="min-h-[100px] scroll-mt-24"
                placeholder="Escreva suas anotações brutas da sessão aqui... temas abordados, observações, combinados, etc."
                value={evoSummary}
                onChange={(e) => setEvoSummary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Tarefa de Casa</Label>
              <Textarea
                rows={2}
                className="min-h-[56px] scroll-mt-24"
                placeholder="Atividade para o paciente realizar até a próxima sessão..."
                value={evoHomework}
                onChange={(e) => setEvoHomework(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-[44px] flex-1 border-primary/30 text-primary hover:bg-primary/10"
                onClick={organizeNotes}
                disabled={organizing || !evoSummary.trim()}
              >
                {organizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                ✨ Organizar Notas
              </Button>
              <Button variant="accent" className="min-h-[44px] flex-1" onClick={saveEvolution} disabled={savingEvo}>
                {savingEvo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Registrar Evolução
              </Button>
            </div>
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Notas Organizadas
              </h4>
              <Button size="sm" variant="accent" className="min-h-[36px]" onClick={copyToEvolution}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar para a Evolução
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-foreground [&_h2]:text-sm [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-3 [&_h2]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_ul]:text-sm [&_li]:text-sm">
              <ReactMarkdown>{aiResult}</ReactMarkdown>
            </div>
          </div>
        )}

        {evolutions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhuma evolução registrada.</p>
        ) : (
          <ul className="space-y-3">
            {evolutions.map((evo) => {
              const isEditing = editingEvoId === evo.id;
              return (
                <li key={evo.id} className="rounded-xl border border-border p-4 space-y-2 relative">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {format(new Date(evo.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
                    </p>
                    {!readOnly && !isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditEvo(evo)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                          aria-label="Editar registro"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvo(evo.id)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Excluir registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Resumo</Label>
                        <Textarea rows={4} value={editEvoSummary} onChange={(e) => setEditEvoSummary(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Tarefa de Casa</Label>
                        <Textarea rows={2} value={editEvoHomework} onChange={(e) => setEditEvoHomework(e.target.value)} />
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={cancelEditEvo} disabled={savingEvoEdit}>
                          Cancelar
                        </Button>
                        <Button type="button" variant="accent" size="sm" onClick={saveEditEvo} disabled={savingEvoEdit}>
                          {savingEvoEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Salvar alteração
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {evo.session_summary && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/60">Resumo</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{evo.session_summary}</p>
                        </div>
                      )}
                      {evo.homework && (
                        <div>
                          <p className="text-xs font-semibold text-accent">Tarefa de Casa</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{evo.homework}</p>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
};
