import { format } from "date-fns";
import { Target } from "lucide-react";
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

export interface SessionPlanningValue {
  next_scheduled_at: string; // datetime-local (yyyy-MM-ddTHH:mm) or ""
  next_objetivo: string;
  next_retomar: string;
  next_meta_id: string | null;
  next_tecnicas: string[];
  next_observacoes: string;
}

export const emptyPlanningValue: SessionPlanningValue = {
  next_scheduled_at: "",
  next_objetivo: "",
  next_retomar: "",
  next_meta_id: null,
  next_tecnicas: [],
  next_observacoes: "",
};

export function planningValueFromDb(input: {
  scheduled_at?: string | null;
  objetivo?: string | null;
  retomar?: string | null;
  meta_id?: string | null;
  tecnicas?: string[] | null;
  observacoes?: string | null;
}): SessionPlanningValue {
  return {
    next_scheduled_at: input.scheduled_at
      ? format(new Date(input.scheduled_at), "yyyy-MM-dd'T'HH:mm")
      : "",
    next_objetivo: input.objetivo ?? "",
    next_retomar: input.retomar ?? "",
    next_meta_id: input.meta_id ?? null,
    next_tecnicas: Array.isArray(input.tecnicas) ? input.tecnicas : [],
    next_observacoes: input.observacoes ?? "",
  };
}

export function hasPlanningContent(v: SessionPlanningValue): boolean {
  return !!(
    v.next_objetivo.trim() ||
    v.next_retomar.trim() ||
    v.next_observacoes.trim() ||
    v.next_tecnicas.length > 0 ||
    v.next_meta_id ||
    v.next_scheduled_at
  );
}

interface Props {
  value: SessionPlanningValue;
  onChange: (patch: Partial<SessionPlanningValue>) => void;
  planGoals: { id: string; descricao: string }[];
  planTechniques: { id: string; nome: string }[];
  showScheduledAt?: boolean;
  scheduledAtLocked?: boolean;
  scheduledAtHint?: string;
  helperText?: string;
  className?: string;
}

/**
 * Presentational-only form for the "Próxima sessão" planning block.
 * Does NOT persist anything. Parent decides when and how to save.
 * Used by RegistroSessao, Agenda and PlanoTratamento to keep a single UI.
 */
export function SessionPlanningForm({
  value,
  onChange,
  planGoals,
  planTechniques,
  showScheduledAt = true,
  helperText,
  className,
}: Props) {
  const toggleTech = (nome: string) => {
    onChange({
      next_tecnicas: value.next_tecnicas.includes(nome)
        ? value.next_tecnicas.filter((n) => n !== nome)
        : [...value.next_tecnicas, nome],
    });
  };

  return (
    <section
      className={cn("rounded-lg border p-4 space-y-4", className)}
      style={{ borderColor: "#E5E7EB", background: "#FAF8FF" }}
    >
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4" style={{ color: "#534AB7" }} />
        <h3 className="font-display text-sm font-semibold" style={{ color: "#1A1A2E" }}>
          Próxima sessão — planejamento
        </h3>
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground -mt-2">{helperText}</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {showScheduledAt && (
          <div className="space-y-2">
            <Label>Data e horário da próxima sessão</Label>
            <Input
              type="datetime-local"
              value={value.next_scheduled_at}
              onChange={(e) => onChange({ next_scheduled_at: e.target.value })}
              style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
            />
            <p className="text-[11px] text-muted-foreground">Deixe em branco para não agendar agora.</p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Meta vinculada</Label>
          <Select
            value={value.next_meta_id ?? "none"}
            onValueChange={(v) => onChange({ next_meta_id: v === "none" ? null : v })}
          >
            <SelectTrigger style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13 }}>
              <SelectValue placeholder="Sem meta vinculada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem meta vinculada</SelectItem>
              {planGoals.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.descricao}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Objetivo da próxima sessão</Label>
        <Textarea
          rows={2}
          placeholder="O que se pretende trabalhar no próximo encontro..."
          value={value.next_objetivo}
          onChange={(e) => onChange({ next_objetivo: e.target.value })}
          style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
        />
      </div>

      <div className="space-y-2">
        <Label>Retomar / Continuidade</Label>
        <Textarea
          rows={2}
          placeholder="Assuntos, tarefas ou combinados a serem retomados..."
          value={value.next_retomar}
          onChange={(e) => onChange({ next_retomar: e.target.value })}
          style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
        />
      </div>

      <div className="space-y-2">
        <Label>Técnicas previstas</Label>
        {planTechniques.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {planTechniques.map((t) => {
              const active = value.next_tecnicas.includes(t.nome);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTech(t.nome)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-colors",
                    active
                      ? "bg-[#534AB7] text-white border-[#534AB7]"
                      : "bg-white text-[#1A1A2E] border-[#E5E7EB] hover:border-[#534AB7]"
                  )}
                >
                  {t.nome}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma técnica cadastrada no Plano Terapêutico deste paciente.
          </p>
        )}
        {/* Técnicas avulsas selecionadas que não estão no plano */}
        {value.next_tecnicas.filter((n) => !planTechniques.some((t) => t.nome === n)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.next_tecnicas
              .filter((n) => !planTechniques.some((t) => t.nome === n))
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleTech(n)}
                  className="text-xs px-3 py-1 rounded-full border bg-[#534AB7] text-white border-[#534AB7]"
                  title="Remover"
                >
                  {n} ×
                </button>
              ))}
          </div>
        )}
        <Input
          placeholder="Adicionar técnica avulsa (Enter para confirmar)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = (e.target as HTMLInputElement).value.trim();
              if (v && !value.next_tecnicas.includes(v)) {
                onChange({ next_tecnicas: [...value.next_tecnicas, v] });
              }
              (e.target as HTMLInputElement).value = "";
            }
          }}
          style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
        />
      </div>

      <div className="space-y-2">
        <Label>Observações do planejamento</Label>
        <Textarea
          rows={2}
          placeholder="Notas adicionais sobre a próxima sessão..."
          value={value.next_observacoes}
          onChange={(e) => onChange({ next_observacoes: e.target.value })}
          style={{ border: "1px solid #E5E7EB", borderRadius: 7, backgroundColor: "#F9FAFB", fontSize: 13, color: "#1A1A2E" }}
        />
      </div>
    </section>
  );
}
