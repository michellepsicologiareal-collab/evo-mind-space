import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EMOTIONS = ["Ansiedade", "Tristeza", "Raiva", "Culpa", "Vergonha", "Medo", "Calma", "Alegria", "Esperança", "Gratidão"];
const FACES = ["😣", "😣", "😟", "😟", "😕", "😐", "🙂", "🙂", "😊", "😄", "😄"];

type MoodRow = { id: string; recorded_at: string; wellbeing_score: number; emotions: string[] | null; patient_context: string | null };

interface Props { token: string; password: string; accent: string; ink: string; muted: string }

/** Registro de humor feito pelo próprio paciente no link do RPD. */
export const PatientMoodSelfReport = ({ token, password, accent, ink, muted }: Props) => {
  const [score, setScore] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MoodRow[]>([]);

  const load = async () => {
    const { data } = await (supabase as any).rpc("list_mood_by_token", { _token: token, _password: password });
    setRows((data as MoodRow[]) ?? []);
  };
  useEffect(() => { void load(); }, [token, password]);

  const toggle = (e: string) => setEmotions((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  const save = async () => {
    if (score == null) { toast.error("Escolha uma nota de 0 a 10."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("submit_mood_by_token", {
      _token: token, _password: password, _score: score, _emotions: emotions, _note: note.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar. Tente novamente."); return; }
    toast.success("Humor registrado. Obrigado!");
    setScore(null); setEmotions([]); setNote("");
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-[10px] p-4 sm:p-6 space-y-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div>
          <p className="font-display text-base font-bold" style={{ color: ink }}>Como você está hoje?</p>
          <p className="text-[13px]" style={{ color: muted }}>0 = muito mal · 10 = muito bem</p>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              aria-pressed={score === n}
              className="min-h-12 rounded-[8px] border text-sm font-semibold flex flex-col items-center justify-center"
              style={score === n ? { background: accent, color: "#fff", borderColor: accent } : { color: ink, borderColor: "rgba(0,0,0,0.1)" }}
            >
              <span className="text-base leading-none">{FACES[n]}</span>{n}
            </button>
          ))}
        </div>
        <div>
          <p className="text-[13px] font-semibold mb-2" style={{ color: ink }}>O que você está sentindo?</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                aria-pressed={emotions.includes(e)}
                className="min-h-10 rounded-full border px-3 text-[13px] font-medium"
                style={emotions.includes(e) ? { background: accent, color: "#fff", borderColor: accent } : { color: ink, borderColor: "rgba(0,0,0,0.1)" }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold mb-2" style={{ color: ink }}>Quer contar como foi seu dia? (opcional)</p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} className="text-base" placeholder="Escreva com suas palavras…" />
        </div>
        <Button onClick={save} disabled={saving} className="w-full min-h-12 text-base" style={{ background: accent, color: "#fff", fontWeight: 600 }}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar meu humor
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-[10px] p-4 space-y-2" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p className="text-[13px] font-semibold" style={{ color: ink }}>Meus registros de humor</p>
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 border-t pt-2 text-[13px]" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <span className="text-xl">{FACES[r.wellbeing_score] ?? "🙂"}</span>
              <div className="min-w-0 flex-1">
                <p style={{ color: ink }}><strong>{r.wellbeing_score}/10</strong> · {format(new Date(r.recorded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                {!!r.emotions?.length && <p style={{ color: muted }}>{r.emotions.join(" · ")}</p>}
                {r.patient_context && <p className="break-words" style={{ color: muted }}>{r.patient_context}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
