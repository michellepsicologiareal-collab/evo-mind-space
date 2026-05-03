import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logClinicalAccess } from "@/utils/auditLog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Save, Plus, Check, Trash2, Brain, MessageSquare, ListChecks, BookOpen, Sparkles, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Goal {
  text: string;
  completed: boolean;
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

export const CaseFormulation = ({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulation state
  const [systems, setSystems] = useState<Record<SystemKey, string>>({
    environment: "", thoughts: "", emotions: "", behaviors: "", physical_reactions: "",
  });
  const [coreBeliefs, setCoreBeliefs] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [formId, setFormId] = useState<string | null>(null);

  // Evolutions state
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [evoSummary, setEvoSummary] = useState("");
  const [evoHomework, setEvoHomework] = useState("");
  const [savingEvo, setSavingEvo] = useState(false);

  // AI organize state
  const [organizing, setOrganizing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [formRes, evoRes] = await Promise.all([
        supabase
          .from("case_formulations")
          .select("*")
          .eq("patient_id", patientId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("session_evolutions")
          .select("*")
          .eq("patient_id", patientId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
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
        setGoals(Array.isArray(f.treatment_goals) ? (f.treatment_goals as unknown as Goal[]) : []);
      }
      setEvolutions((evoRes.data as Evolution[]) ?? []);
      setLoading(false);
      // Audit: log access to case formulation
      if (formRes.data) logClinicalAccess("case_formulation", formRes.data.id, patientId);
    };
    load();
  }, [user, patientId]);

  const saveFormulation = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      patient_id: patientId,
      user_id: user.id,
      ...systems,
      core_beliefs: coreBeliefs,
      treatment_goals: JSON.parse(JSON.stringify(goals)),
    };

    if (formId) {
      const { error } = await supabase.from("case_formulations").update(payload).eq("id", formId);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("case_formulations").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao criar formulação"); setSaving(false); return; }
      setFormId(data.id);
    }
    toast.success("Formulação salva");
    setSaving(false);
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals((prev) => [...prev, { text: newGoal.trim(), completed: false }]);
    setNewGoal("");
  };

  const toggleGoal = (i: number) => {
    setGoals((prev) => prev.map((g, idx) => idx === i ? { ...g, completed: !g.completed } : g));
  };

  const removeGoal = (i: number) => {
    setGoals((prev) => prev.filter((_, idx) => idx !== i));
  };

  const saveEvolution = async () => {
    if (!user || (!evoSummary.trim() && !evoHomework.trim())) return;
    setSavingEvo(true);
    const { data, error } = await supabase
      .from("session_evolutions")
      .insert({
        patient_id: patientId,
        user_id: user.id,
        session_summary: evoSummary.trim(),
        homework: evoHomework.trim(),
      })
      .select("*")
      .single();
    setSavingEvo(false);
    if (error) { toast.error("Erro ao salvar evolução"); return; }
    setEvolutions((prev) => [data as Evolution, ...prev]);
    setEvoSummary("");
    setEvoHomework("");
    toast.success("Evolução registrada");
  };

  const organizeNotes = async () => {
    const notes = evoSummary.trim();
    if (!notes) {
      toast.error("Escreva suas anotações antes de organizar.");
      return;
    }
    setOrganizing(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("organize-notes", {
        body: { notes },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAiResult(data.result);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao organizar notas. Tente novamente.");
    } finally {
      setOrganizing(false);
    }
  };

  const copyToEvolution = () => {
    if (!aiResult) return;
    setEvoSummary(aiResult);
    setAiResult(null);
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
          <ListChecks className="h-4 w-4 mr-1 hidden sm:inline" /> Metas
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
            <Textarea
              rows={3}
              className="min-h-[72px] scroll-mt-24"
              placeholder={sys.placeholder}
              value={systems[sys.key]}
              onChange={(e) => setSystems((prev) => ({ ...prev, [sys.key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="space-y-1.5 pt-2">
          <Label className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" /> Crenças Nucleares
          </Label>
          <p className="text-xs text-muted-foreground mb-1">Visão de Si, do Mundo e do Futuro</p>
          <Textarea
            rows={4}
            className="min-h-[90px] scroll-mt-24 border-accent/30"
            placeholder="Ex.: 'Eu sou incapaz' (Si) · 'O mundo é ameaçador' (Mundo) · 'Nada vai melhorar' (Futuro)"
            value={coreBeliefs}
            onChange={(e) => setCoreBeliefs(e.target.value)}
          />
        </div>

        <Button variant="accent" className="min-h-[44px] w-full" onClick={saveFormulation} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Formulação
        </Button>
      </TabsContent>

      {/* ── Treatment Goals ── */}
      <TabsContent value="goals" className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display font-bold text-foreground flex items-center gap-2 mb-1">
            <ListChecks className="h-4 w-4 text-accent" /> Metas do Tratamento
          </h3>
          <p className="text-xs text-muted-foreground">Adicione e acompanhe os objetivos terapêuticos.</p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Novo objetivo..."
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            className="scroll-mt-24"
          />
          <Button variant="accent" size="icon" className="shrink-0 min-h-[44px] min-w-[44px]" onClick={addGoal}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {goals.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma meta definida ainda.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  g.completed ? "bg-accent/5 border-accent/20" : "border-border"
                )}
              >
                <button
                  onClick={() => toggleGoal(i)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    g.completed ? "bg-accent border-accent text-white" : "border-border hover:border-accent/50"
                  )}
                >
                  {g.completed && <Check className="h-3.5 w-3.5" />}
                </button>
                <span className={cn("flex-1 text-sm", g.completed && "line-through text-muted-foreground")}>
                  {g.text}
                </span>
                <button
                  onClick={() => removeGoal(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="accent" className="min-h-[44px] w-full" onClick={saveFormulation} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Metas
        </Button>
      </TabsContent>

      {/* ── Session Evolution ── */}
      <TabsContent value="evolution" className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display font-bold text-foreground flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-accent" /> Evolução Diária
          </h3>
          <p className="text-xs text-muted-foreground">Registre o resumo e a tarefa de casa de cada sessão.</p>
        </div>

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

        {/* AI Result */}
        {aiResult && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Notas Organizadas
              </h4>
              <Button
                size="sm"
                variant="accent"
                className="min-h-[36px]"
                onClick={copyToEvolution}
              >
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
            {evolutions.map((evo) => (
              <li key={evo.id} className="rounded-xl border border-border p-4 space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {format(new Date(evo.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
};
