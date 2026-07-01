import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const EMOTIONS_V2 = [
  "Ansiedade", "Tristeza", "Raiva", "Medo", "Culpa",
  "Vergonha", "Alegria", "Esperança", "Alívio", "Frustração",
] as const;

export type V2Form = {
  wellbeing_score: string;
  wellbeing_source: "" | "patient_self_report" | "professional_estimate";
  patient_context: string;
  clinical_observation: string;
  emotions: string[];
  attention_flag: "not_assessed" | "none" | "watch" | "urgent";
};

interface Props {
  value: V2Form;
  onChange: (patch: Partial<V2Form>) => void;
  // Optional legacy read-only display
  legacyMood?: number | null;
  legacyNote?: string | null;
  legacyDate?: string | null;
  dataModel?: "legacy_unclassified" | "v2_structured";
}

export const ClinicalV2Block = ({ value, onChange, legacyMood, legacyNote, legacyDate, dataModel }: Props) => {
  const isLegacy = dataModel === "legacy_unclassified" && (legacyMood != null || (legacyNote && legacyNote.length > 0));
  const toggleEmotion = (emo: string) => {
    const next = value.emotions.includes(emo)
      ? value.emotions.filter((e) => e !== emo)
      : [...value.emotions, emo];
    onChange({ emotions: next });
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-3 space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Registro clínico da sessão</p>
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
            Este registro foi feito no modelo anterior e é mantido apenas para consulta. Preencha o novo modelo abaixo se quiser atualizá-lo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2 sm:col-span-1">
          <Label>Bem-estar (0–10)</Label>
          <Input
            type="number" min="0" max="10" placeholder="—"
            value={value.wellbeing_score}
            onChange={(e) => onChange({ wellbeing_score: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Fonte do bem-estar</Label>
          <Select
            value={value.wellbeing_source || "unset"}
            onValueChange={(v) => onChange({ wellbeing_source: (v === "unset" ? "" : v) as V2Form["wellbeing_source"] })}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">— não informado —</SelectItem>
              <SelectItem value="patient_self_report">Autorrelato do paciente</SelectItem>
              <SelectItem value="professional_estimate">Estimativa do profissional</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Contexto trazido pelo paciente</Label>
        <Textarea
          rows={2} maxLength={4000}
          placeholder="Fala/vivência trazida pelo paciente na sessão."
          value={value.patient_context}
          onChange={(e) => onChange({ patient_context: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Observação clínica</Label>
        <Textarea
          rows={2} maxLength={4000}
          placeholder="Sua leitura clínica da sessão."
          value={value.clinical_observation}
          onChange={(e) => onChange({ clinical_observation: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emoções observadas</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONS_V2.map((emo) => {
            const active = value.emotions.includes(emo);
            return (
              <button
                key={emo}
                type="button"
                onClick={() => toggleEmotion(emo)}
                className="text-xs rounded-full px-3 py-1 transition-colors"
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 600,
                  background: active ? "rgba(150,117,206,0.18)" : "#fff",
                  color: active ? "hsl(var(--primary-dark))" : "hsl(var(--primary-glow))",
                  border: active ? "0.5px solid rgba(150,117,206,0.45)" : "0.5px solid hsl(var(--border))",
                }}
              >
                {emo}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          Sinalizador clínico de atenção
        </Label>
        <Select
          value={value.attention_flag}
          onValueChange={(v) => onChange({ attention_flag: v as V2Form["attention_flag"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="not_assessed">Não avaliado</SelectItem>
            <SelectItem value="none">Avaliado — sem atenção necessária</SelectItem>
            <SelectItem value="watch">Observar</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>
        {value.attention_flag !== "not_assessed" && (
          <p className="text-[11px] text-muted-foreground">
            A marcação de atenção fica registrada em auditoria com autor e data.
          </p>
        )}
      </div>
    </div>
  );
};
