import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Smile, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  patientId: string;
  patientName?: string;
}

interface MoodRow {
  id: string;
  recorded_at: string;
  mood_score: number | null;
  note: string | null;
}

const moodEmoji = (score: number) =>
  score >= 8 ? "🤩" : score >= 6 ? "🙂" : score >= 4 ? "😐" : score >= 2 ? "😔" : "😫";

export const PatientMoodChart = ({ patientId }: Props) => {
  const [rows, setRows] = useState<MoodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("patient_progress")
        .select("id, recorded_at, mood_score, note")
        .eq("patient_id", patientId)
        .not("mood_score", "is", null)
        .order("recorded_at", { ascending: true });
      setRows((data as MoodRow[]) ?? []);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Smile className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">Nenhum registro de humor ainda.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Registre o humor do paciente em "Registros de Sessão" para ver a evolução aqui.
        </p>
      </div>
    );
  }

  const chartData = rows.map((r) => ({
    name: format(new Date(r.recorded_at), "dd/MM"),
    score: Number(r.mood_score),
    note: r.note,
  }));

  const scores = rows.map((r) => Number(r.mood_score));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const last = scores[scores.length - 1];
  const first = scores[0];
  const trend = last - first;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const TrendIcon = trend > 0.5 ? TrendingUp : trend < -0.5 ? TrendingDown : Minus;
  const trendColor =
    trend > 0.5 ? "text-emerald-600" : trend < -0.5 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-muted/30 p-3 text-center">
          <p className="text-lg font-display font-bold text-foreground">{rows.length}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Registros</p>
        </div>
        <div className="rounded-xl bg-lilac/30 p-3 text-center">
          <p className="text-lg font-display font-bold text-foreground">
            {avg.toFixed(1)} <span className="text-sm">{moodEmoji(avg)}</span>
          </p>
          <p className="text-[10px] uppercase text-muted-foreground">Média</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-lg font-display font-bold text-emerald-700">
            {max} <span className="text-sm">{moodEmoji(max)}</span>
          </p>
          <p className="text-[10px] uppercase text-muted-foreground">Máximo</p>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 text-center">
          <p className={`text-lg font-display font-bold flex items-center justify-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}
          </p>
          <p className="text-[10px] uppercase text-muted-foreground">Tendência</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs uppercase text-muted-foreground mb-2">Evolução do Humor (0-10)</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value}/10 ${moodEmoji(value)}`, "Humor"]}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                fill="url(#moodGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* List */}
      <div>
        <p className="text-xs uppercase text-muted-foreground mb-2">Histórico</p>
        <div className="space-y-2">
          {[...rows].reverse().map((r) => {
            const score = Number(r.mood_score);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3 flex items-start gap-3">
                <div className="text-2xl">{moodEmoji(score)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{score}/10</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.recorded_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{r.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
