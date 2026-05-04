import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionHistoryProps {
  patientId: string;
}

interface SessionRow {
  id: string;
  scheduled_at: string;
  status: string;
  duration_minutes: number;
  price: number | null;
  notes: string | null;
}

interface MoodRow {
  session_id: string | null;
  mood_score: number | null;
  note: string | null;
  recorded_at: string;
}

const statusLabel: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};

const statusColor: Record<string, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-lilac text-lilac-foreground",
  no_show: "bg-destructive/15 text-destructive",
  rescheduled: "bg-sand text-sand-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export const PatientSessionHistory = ({ patientId }: SessionHistoryProps) => {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [moods, setMoods] = useState<MoodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();

      const [sessRes, moodRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, scheduled_at, status, duration_minutes, price, notes")
          .eq("patient_id", patientId)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to)
          .order("scheduled_at"),
        supabase
          .from("patient_progress")
          .select("session_id, mood_score, note, recorded_at")
          .eq("patient_id", patientId)
          .gte("recorded_at", from)
          .lte("recorded_at", to)
          .order("recorded_at"),
      ]);

      setSessions(sessRes.data ?? []);
      setMoods(moodRes.data ?? []);
      setLoading(false);
    })();
  }, [patientId, month]);

  const moodMap = new Map(moods.filter(m => m.session_id).map(m => [m.session_id!, m]));

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-display text-sm font-semibold capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma sessão neste mês.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const mood = moodMap.get(s.id);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-center shrink-0 w-12">
                    <p className="text-lg font-display font-bold text-foreground leading-none">
                      {format(new Date(s.scheduled_at), "dd")}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {format(new Date(s.scheduled_at), "EEE", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {format(new Date(s.scheduled_at), "HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor[s.status] ?? "bg-muted text-muted-foreground")}>
                        {statusLabel[s.status] ?? s.status}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {s.price != null && (
                    <span className="text-xs font-medium text-foreground">
                      R$ {Number(s.price).toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {mood && mood.mood_score != null && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
                      <span className="text-xs font-medium text-primary">Humor: {mood.mood_score}/10</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mood timeline summary */}
          {moods.some(m => m.mood_score != null) && (
            <div className="rounded-xl border border-border bg-card p-4 mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Evolução do Humor
              </p>
              <div className="flex items-end gap-1 h-16">
                {moods
                  .filter(m => m.mood_score != null)
                  .map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-primary/70 transition-all"
                        style={{ height: `${(m.mood_score! / 10) * 100}%` }}
                        title={`Humor: ${m.mood_score}/10${m.note ? ` — ${m.note}` : ""}`}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {format(new Date(m.recorded_at), "dd")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
            <span>Total: {sessions.length} sessões</span>
            <span>Realizadas: {sessions.filter(s => s.status === "completed").length}</span>
            <span>Faltas: {sessions.filter(s => s.status === "no_show").length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
