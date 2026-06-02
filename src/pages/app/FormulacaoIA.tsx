import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Save, RefreshCw, Brain, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Patient = { id: string; full_name: string };

type Formulation = {
  environment: string;
  thoughts: string;
  emotions: string;
  behaviors: string;
  physical_reactions: string;
  core_beliefs: string;
  treatment_goals: Array<{ objective: string } | string>;
};

const FIELDS: Array<{ key: keyof Formulation; label: string; helper: string }> = [
  { key: "environment", label: "Ambiente / Situação", helper: "Contexto e gatilhos do caso." },
  { key: "thoughts", label: "Pensamentos", helper: "Pensamentos automáticos centrais." },
  { key: "emotions", label: "Emoções", helper: "Emoções predominantes e intensidade." },
  { key: "behaviors", label: "Comportamentos", helper: "Padrões de enfrentamento ou evitação." },
  { key: "physical_reactions", label: "Reações físicas", helper: "Reações somáticas associadas." },
  { key: "core_beliefs", label: "Crenças centrais", helper: "Crenças nucleares e regras condicionais." },
];

export default function FormulacaoIA() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [useClinical, setUseClinical] = useState(true);
  const [contextCounts, setContextCounts] = useState<{ sessions: number; records: number; evolutions: number; progress: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setPatients((data ?? []) as Patient[]);
    })();
  }, [user]);

  // Count how much clinical context is available for the selected patient.
  useEffect(() => {
    if (!user || !patientId) { setContextCounts(null); return; }
    (async () => {
      const [s, r, e, p] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("patient_id", patientId).not("notes", "is", null).neq("notes", ""),
        supabase.from("session_records").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("patient_id", patientId),
        supabase.from("session_evolutions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("patient_id", patientId),
        supabase.from("patient_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("patient_id", patientId),
      ]);
      setContextCounts({
        sessions: s.count ?? 0,
        records: r.count ?? 0,
        evolutions: e.count ?? 0,
        progress: p.count ?? 0,
      });
    })();
  }, [user, patientId]);

  const hasAnyClinical = !!contextCounts && (contextCounts.sessions + contextCounts.records + contextCounts.evolutions + contextCounts.progress) > 0;

  const generate = async () => {
    if (!patientId) { toast.error("Selecione um paciente."); return; }
    const includeCtx = useClinical && hasAnyClinical;
    if (!includeCtx && rawText.trim().length < 20) { toast.error("Inclua os registros clínicos ou escreva ao menos algumas frases."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-formulation", {
        body: { patient_id: patientId, raw_text: rawText, save: true, include_clinical_context: includeCtx },
      });
      if (error) throw error;
      const f = (data as any)?.formulation as Formulation | undefined;
      if (!f) { toast.error((data as any)?.error || "Não foi possível gerar."); return; }
      setFormulation(f);
      toast.success("Formulação gerada e salva.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar formulação.");
    } finally {
      setLoading(false);
    }
  };


  const saveEdits = async () => {
    if (!formulation || !patientId || !user) return;
    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        user_id: user.id,
        environment: formulation.environment,
        thoughts: formulation.thoughts,
        emotions: formulation.emotions,
        behaviors: formulation.behaviors,
        physical_reactions: formulation.physical_reactions,
        core_beliefs: formulation.core_beliefs,
        treatment_goals: (formulation.treatment_goals || []).map((g) =>
          typeof g === "string" ? { objective: g } : g,
        ),
      };
      const { error } = await supabase
        .from("case_formulations")
        .upsert(payload, { onConflict: "patient_id,user_id" });
      if (error) throw error;
      toast.success("Alterações salvas.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const goalsText = useMemo(() => {
    if (!formulation) return "";
    return (formulation.treatment_goals || [])
      .map((g) => (typeof g === "string" ? g : g?.objective || ""))
      .filter(Boolean)
      .join("\n");
  }, [formulation]);

  const setGoalsFromText = (text: string) => {
    if (!formulation) return;
    const arr = text.split("\n").map((s) => s.trim()).filter(Boolean).map((o) => ({ objective: o }));
    setFormulation({ ...formulation, treatment_goals: arr });
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        <header className="space-y-1">
          <h1 className="font-display" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-0.3px", color: "hsl(var(--foreground))" }}>
            Formulação com IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Escreva livremente sobre o caso. A IA organiza em uma formulação TCC (Padesky) e salva no paciente.
          </p>
        </header>

        <section className="bg-white rounded-[10px] p-5 space-y-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Selecione um paciente ativo" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Relato livre do caso
            </Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ex: paciente de 32 anos, queixa de ansiedade no trabalho, evita reuniões, sente coração acelerado, pensa 'vou fracassar', tem histórico de pai crítico..."
              className="min-h-[180px] resize-y"
            />
            <p className="text-[11px] text-muted-foreground">{rawText.length} caracteres • escreva à vontade, a IA estrutura.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={loading || !patientId} variant="accent">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Gerando..." : formulation ? "Regenerar formulação" : "Gerar formulação"}
            </Button>
            {formulation && (
              <Button variant="outline" onClick={() => { setFormulation(null); }}>
                <RefreshCw className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </section>

        {formulation && (
          <section className="bg-white rounded-[10px] p-5 space-y-5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Formulação TCC (Padesky)</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</Label>
                  <Textarea
                    value={(formulation as any)[f.key] ?? ""}
                    onChange={(e) => setFormulation({ ...formulation, [f.key]: e.target.value } as Formulation)}
                    className="min-h-[100px] text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">{f.helper}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metas terapêuticas (uma por linha)</Label>
              <Textarea
                value={goalsText}
                onChange={(e) => setGoalsFromText(e.target.value)}
                className="min-h-[110px] text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={saveEdits} disabled={saving} variant="accent">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
