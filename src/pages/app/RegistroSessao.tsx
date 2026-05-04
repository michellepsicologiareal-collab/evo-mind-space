import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
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
};

const RegistroSessao = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      setPatients(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const toggleTheme = useCallback((theme: string) => {
    setForm((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  }, []);

  const handleClear = () => {
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.patient_id) {
      toast.error("Selecione um paciente.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("session_records").insert({
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
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar registro.");
      console.error(error);
      return;
    }

    toast.success("Registro salvo com sucesso.");
    handleClear();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Registro de Sessão
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documente os dados clínicos da sessão realizada.
        </p>
      </div>

      {/* ── Seção 1: Identificação ── */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-foreground border-b border-border pb-2">
          1. Identificação
        </h2>

        <div className="space-y-2">
          <Label>Paciente</Label>
          <Select
            value={form.patient_id}
            onValueChange={(v) => setForm({ ...form, patient_id: v })}
          >
            <SelectTrigger>
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Sessão nº</Label>
            <Input
              type="number"
              min="1"
              placeholder="—"
              value={form.session_number}
              onChange={(e) =>
                setForm({ ...form, session_number: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select
              value={form.modality}
              onValueChange={(v) => setForm({ ...form, modality: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Input
              type="number"
              min="10"
              max="480"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({ ...form, duration_minutes: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </section>

      {/* ── Seção 2: Estado do Paciente ── */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-foreground border-b border-border pb-2">
          2. Estado do Paciente
        </h2>
        <div className="space-y-2">
          <Label>Queixa principal / Tema trazido</Label>
          <Textarea
            rows={3}
            placeholder="Descreva a queixa ou tema central apresentado pelo paciente nesta sessão..."
            value={form.chief_complaint}
            onChange={(e) =>
              setForm({ ...form, chief_complaint: e.target.value })
            }
          />
        </div>
      </section>

      {/* ── Seção 3: Conteúdo da Sessão ── */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-foreground border-b border-border pb-2">
          3. Conteúdo da Sessão
        </h2>

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
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
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
      </section>

      {/* ── Seção 4: Avaliação do Terapeuta ── */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-foreground border-b border-border pb-2">
          4. Avaliação do Terapeuta
        </h2>

        <div className="space-y-2">
          <Label>
            Engajamento do paciente:{" "}
            <span className="font-semibold text-primary">
              {ENGAGEMENT_LABELS[form.engagement - 1]}
            </span>
          </Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setForm({ ...form, engagement: level })}
                className={cn(
                  "flex-1 h-9 rounded-lg text-sm font-medium transition-all duration-200 border",
                  form.engagement >= level
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                {level}
              </button>
            ))}
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
      </section>

      {/* ── Ações ── */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleClear}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpar
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
          Salvar registro
        </Button>
      </div>
    </div>
  );
};

export default RegistroSessao;
