import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Flower2, Save, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const MOOD_EMOJIS = [
  { emoji: "🤩", label: "Ótimo" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😔", label: "Baixo" },
  { emoji: "😫", label: "Esgotado" },
];

export const TRIGGER_OPTIONS = [
  "Impotência",
  "Raiva",
  "Gatilho Pessoal",
  "Ansiedade",
  "Identificação",
  "Tristeza",
  "História pessoal",
  "Outro",
];

interface Props {
  /** Paciente da sessão (opcional — o registro pode ser geral). */
  patientId?: string | null;
  /** Data da sessão no formato yyyy-MM-dd. */
  sessionDate: string;
  className?: string;
}

/**
 * Bloco "Ativação do terapeuta" — registra como o terapeuta ficou após a sessão.
 * Salva em therapist_triggers, alimentando automaticamente o módulo Autocuidado.
 */
export const TherapistActivation = ({ patientId, sessionDate, className }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [mood, setMood] = useState("😐");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!user || !sessionDate) return;
    setLoading(true);
    let q = (supabase as any)
      .from("therapist_triggers")
      .select("id, mood_emoji, triggers, reflective_note")
      .eq("user_id", user.id)
      .eq("checked_at", sessionDate)
      .order("created_at", { ascending: false })
      .limit(1);
    q = patientId ? q.eq("patient_id", patientId) : q.is("patient_id", null);
    const { data } = await q;
    const row = (data ?? [])[0];
    if (row) {
      setRecordId(row.id);
      setMood(row.mood_emoji ?? "😐");
      setTriggers(Array.isArray(row.triggers) ? row.triggers : []);
      setNote(row.reflective_note ?? "");
    } else {
      setRecordId(null);
      setMood("😐");
      setTriggers([]);
      setNote("");
    }
    setLoading(false);
  }, [user, sessionDate, patientId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (t: string) =>
    setTriggers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      checked_at: sessionDate,
      mood_emoji: mood,
      triggers,
      reflective_note: note.trim() || null,
      patient_id: patientId || null,
    };
    const { data, error } = recordId
      ? await (supabase as any).from("therapist_triggers").update(payload).eq("id", recordId).select("id").single()
      : await (supabase as any).from("therapist_triggers").insert(payload).select("id").single();
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar sua ativação.");
      return;
    }
    if (data?.id) setRecordId(data.id);
    toast.success("Ativação registrada no seu Autocuidado 🌿");
  };

  return (
    <section
      className={cn("p-4 sm:p-5 space-y-4", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderRadius: 16,
        border: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-card)",
        borderLeft: "3px solid hsl(var(--lilac, 262 25% 64%))",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flower2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-foreground">Ativação do terapeuta</h3>
            <p className="text-[11px] text-muted-foreground">
              Como você ficou depois desta sessão? Vai direto para o seu Autocuidado.
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Link to="/app/autocuidado">
            Autocuidado <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Seu estado emocional</Label>
            <div className="flex flex-wrap gap-2">
              {MOOD_EMOJIS.map((m) => (
                <button
                  key={m.emoji}
                  type="button"
                  onClick={() => setMood(m.emoji)}
                  className={cn(
                    "flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition-colors",
                    mood === m.emoji
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:bg-secondary/40",
                  )}
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>O que foi ativado em você?</Label>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    triggers.includes(t)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary/40",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nota reflexiva (opcional)</Label>
            <Textarea
              rows={3}
              placeholder="O que essa sessão mobilizou em você e como você quer cuidar disso..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="accent" size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {recordId ? "Atualizar ativação" : "Salvar ativação"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
};

export default TherapistActivation;
