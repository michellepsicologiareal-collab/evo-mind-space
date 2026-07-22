import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Minus, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const EMOTIONS_V2 = [
  "Ansiedade", "Tristeza", "Raiva", "Medo", "Culpa",
  "Vergonha", "Alegria", "Esperança", "Alívio", "Frustração",
] as const;

export const THEMES_V2 = [
  "Ansiedade", "Autoestima", "Relacionamentos", "Família", "Trabalho",
  "Luto", "Trauma", "Identidade", "Corpo", "Sono",
] as const;

export const ENGAGEMENT_LABELS = ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"] as const;

export type V2Form = {
  wellbeing_score: string;
  wellbeing_source: "" | "patient_self_report" | "professional_estimate";
  patient_context: string;
  clinical_observation: string;
  emotions: string[];
  attention_flag: "not_assessed" | "none" | "watch" | "urgent";
  // Novos campos (opcionais — persistência ainda não conectada)
  themes?: string[];
  engagement?: number | null;
  private_notes?: string;
};

interface Props {
  value: V2Form;
  onChange: (patch: Partial<V2Form>) => void;
  legacyMood?: number | null;
  legacyNote?: string | null;
  legacyDate?: string | null;
  dataModel?: "legacy_unclassified" | "v2_structured";
}

const ATTENTION_STYLES: Record<V2Form["attention_flag"], string> = {
  not_assessed: "bg-white text-muted-foreground border-border",
  none:         "bg-white text-foreground border-border",
  watch:        "bg-amber-50 text-amber-900 border-amber-300",
  urgent:       "bg-red-50 text-red-900 border-red-300",
};

const ATTENTION_LABELS: Record<V2Form["attention_flag"], string> = {
  not_assessed: "Não avaliado",
  none:         "Sem atenção",
  watch:        "Observar",
  urgent:       "Urgente",
};

export const ClinicalV2Block = ({ value, onChange, legacyMood, legacyNote, legacyDate, dataModel }: Props) => {
  const isLegacy = dataModel === "legacy_unclassified" && (legacyMood != null || (legacyNote && legacyNote.length > 0));

  const themes = value.themes ?? [];
  const engagement = value.engagement ?? null;
  const privateNotes = value.private_notes ?? "";

  const toggleEmotion = (emo: string) => {
    const next = value.emotions.includes(emo)
      ? value.emotions.filter((e) => e !== emo)
      : [...value.emotions, emo];
    onChange({ emotions: next });
  };

  const toggleTheme = (t: string) => {
    const next = themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t];
    onChange({ themes: next });
  };

  const wbNum = value.wellbeing_score === "" ? null : Number(value.wellbeing_score);
  const setWb = (n: number | null) => {
    if (n == null) return onChange({ wellbeing_score: "" });
    const clamped = Math.max(0, Math.min(10, n));
    onChange({ wellbeing_score: String(clamped) });
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Registro da sessão
        </p>
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-lilac/40 text-primary-dark font-semibold">v2</span>
      </div>

      {isLegacy && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50/60 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
            Humor — registro legado {legacyDate ? `· ${format(new Date(legacyDate), "dd/MM/yyyy", { locale: ptBR })}` : ""}
          </p>
          {legacyMood != null && (
            <p className="text-sm text-foreground">Escore antigo: <strong>{legacyMood}/10</strong></p>
          )}
          {legacyNote && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{legacyNote}</p>
          )}
          <p className="text-[11px] text-amber-900/80 italic mt-1">
            Este registro foi feito no modelo anterior e é mantido apenas para consulta.
          </p>
        </div>
      )}

      {/* ─────── 1. COMO O PACIENTE CHEGOU ─────── */}
      <section className="space-y-4">
        <p className="text-[11px] uppercase tracking-wider text-primary-dark font-semibold">
          1. Como o paciente chegou
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-xs">Bem-estar (0–10)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button" size="icon" variant="outline" className="h-9 w-9"
                onClick={() => setWb((wbNum ?? 0) - 1)}
                aria-label="Diminuir"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number" min="0" max="10" placeholder="—"
                value={value.wellbeing_score}
                onChange={(e) => onChange({ wellbeing_score: e.target.value })}
                className="h-9 w-16 text-center"
              />
              <Button
                type="button" size="icon" variant="outline" className="h-9 w-9"
                onClick={() => setWb((wbNum ?? -1) + 1)}
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fonte do bem-estar</Label>
            <Select
              value={value.wellbeing_source || "unset"}
              onValueChange={(v) => onChange({ wellbeing_source: (v === "unset" ? "" : v) as V2Form["wellbeing_source"] })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">— não informado —</SelectItem>
                <SelectItem value="patient_self_report">Autorrelato do paciente</SelectItem>
                <SelectItem value="professional_estimate">Estimativa do profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Queixa/contexto trazido</Label>
          <Textarea
            rows={2} maxLength={4000}
            placeholder="Fala ou vivência trazida pelo paciente na sessão."
            value={value.patient_context}
            onChange={(e) => onChange({ patient_context: e.target.value })}
          />
        </div>
      </section>

      {/* ─────── 2. LEITURA CLÍNICA ─────── */}
      <section className="space-y-4 pt-2 border-t border-border/60">
        <p className="text-[11px] uppercase tracking-wider text-primary-dark font-semibold">
          2. Leitura clínica
        </p>

        <div className="space-y-2">
          <Label className="text-xs">Observação clínica</Label>
          <Textarea
            rows={3} maxLength={4000}
            placeholder="Sua leitura clínica da sessão."
            value={value.clinical_observation}
            onChange={(e) => onChange({ clinical_observation: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Emoções observadas</Label>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS_V2.map((emo) => {
              const active = value.emotions.includes(emo);
              return (
                <button
                  key={emo}
                  type="button"
                  onClick={() => toggleEmotion(emo)}
                  className={cn(
                    "text-xs rounded-full px-3 py-1 border transition-colors font-medium",
                    active
                      ? "bg-lilac/25 text-primary-dark border-lilac/60"
                      : "bg-white text-primary-glow border-border hover:border-lilac/40"
                  )}
                >
                  {emo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Temas da sessão</Label>
          <div className="flex flex-wrap gap-1.5">
            {THEMES_V2.map((t) => {
              const active = themes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTheme(t)}
                  className={cn(
                    "text-xs rounded-full px-3 py-1 border transition-colors font-medium",
                    active
                      ? "bg-accent/15 text-accent-foreground border-accent/40"
                      : "bg-white text-muted-foreground border-border hover:border-accent/30"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Engajamento do paciente</Label>
            {engagement != null && (
              <button
                type="button"
                onClick={() => onChange({ engagement: null })}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {ENGAGEMENT_LABELS.map((label, i) => {
              const n = i + 1;
              const active = engagement === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ engagement: n })}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-[11px] leading-tight transition-colors text-center",
                    active
                      ? "bg-primary/10 text-primary-dark border-primary/50 font-semibold"
                      : "bg-white text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  <div className="text-sm font-semibold">{n}</div>
                  <div>{label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────── 3. ATENÇÃO CLÍNICA ─────── */}
      <section className="space-y-3 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-[11px] uppercase tracking-wider text-primary-dark font-semibold">
            3. Atenção clínica
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(Object.keys(ATTENTION_LABELS) as V2Form["attention_flag"][]).map((flag) => {
            const active = value.attention_flag === flag;
            return (
              <button
                key={flag}
                type="button"
                onClick={() => onChange({ attention_flag: flag })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-center",
                  ATTENTION_STYLES[flag],
                  active && "ring-2 ring-offset-1 ring-primary/40 font-semibold"
                )}
              >
                {ATTENTION_LABELS[flag]}
              </button>
            );
          })}
        </div>

        {value.attention_flag !== "not_assessed" && (
          <p className="text-[11px] text-muted-foreground">
            A marcação de atenção fica registrada em auditoria com autor e data.
          </p>
        )}
      </section>

      {/* ─────── 4. NOTAS PRIVADAS ─────── */}
      <section className="space-y-2 pt-2 border-t border-border/60">
        <Label className="text-xs">
          Notas privadas <span className="text-muted-foreground font-normal">(não aparecem em relatórios)</span>
        </Label>
        <Textarea
          rows={2} maxLength={4000}
          placeholder="Anotações internas da psicóloga sobre a sessão."
          value={privateNotes}
          onChange={(e) => onChange({ private_notes: e.target.value })}
        />
      </section>
    </div>
  );
};
