import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  patientId: string;
  /** Chamado antes de navegar (ex.: fechar a Sheet). */
  onNavigate?: () => void;
}

interface Step {
  key: string;
  month: string;
  label: string;
  count: number;
  sessionId: string | null;
  hasRecord: boolean;
  statusSummary: [string, number][];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATUS_ORDER = ["completed", "confirmed", "scheduled", "rescheduled", "no_show", "cancelled"];

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};

const STATUS_TEXT: Record<string, string> = {
  scheduled: "text-sky-700",
  confirmed: "text-emerald-700",
  completed: "text-teal-700",
  no_show: "text-destructive",
  rescheduled: "text-amber-700",
  cancelled: "text-muted-foreground",
};

const pickLabel = (themes: string[], count: number) => {
  const freq = new Map<string, number>();
  themes.filter(Boolean).forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1));
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top) return cap(String(top));
  return `${count} ${count === 1 ? "sessão" : "sessões"}`;
};

export const SessionTimeline = ({ patientId, onNavigate }: Props) => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sessRes, progRes, recRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, scheduled_at, status")
          .eq("patient_id", patientId)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("patient_progress")
          .select("session_id, recorded_at, themes")
          .eq("patient_id", patientId),
        supabase
          .from("session_records")
          .select("session_id, session_date, themes")
          .eq("patient_id", patientId),
      ]);

      const buckets = new Map<string, { date: Date; themes: string[]; count: number; sessionId: string | null; sessionAt: number; hasRecord: boolean; statuses: Record<string, number> }>();
      const add = (raw: string | null | undefined, themes: unknown, sessionId: string | null = null, hasRecord = false, status: string | null = null) => {
        if (!raw) return;
        const d = typeof raw === "string" ? parseISO(raw) : new Date(raw);
        if (Number.isNaN(d.getTime())) return;
        const key = format(d, "yyyy-MM");
        const b = buckets.get(key) ?? { date: d, themes: [], count: 0, sessionId: null, sessionAt: -Infinity, hasRecord: false, statuses: {} };
        b.count += 1;
        if (hasRecord) b.hasRecord = true;
        if (status) b.statuses[status] = (b.statuses[status] ?? 0) + 1;
        if (sessionId && d.getTime() > b.sessionAt) {
          b.sessionId = sessionId;
          b.sessionAt = d.getTime();
        }
        if (Array.isArray(themes)) {
          themes.forEach((t) => b.themes.push(typeof t === "string" ? t : String((t as any)?.label ?? "")));
        }
        buckets.set(key, b);
      };

      const themeBySession = new Map<string, string[]>();
      const recordedSessions = new Set<string>();
      [...(progRes.data ?? []), ...(recRes.data ?? [])].forEach((r: any) => {
        if (r.session_id) {
          recordedSessions.add(r.session_id);
          if (Array.isArray(r.themes)) themeBySession.set(r.session_id, r.themes);
        }
      });

      (sessRes.data ?? []).forEach((s: any) =>
        add(s.scheduled_at, themeBySession.get(s.id) ?? [], s.id, recordedSessions.has(s.id), s.status ?? null),
      );

      // registros sem sessão vinculada
      (progRes.data ?? []).forEach((r: any) => {
        if (!r.session_id) add(r.recorded_at, r.themes, null, true);
      });
      (recRes.data ?? []).forEach((r: any) => {
        if (!r.session_id) add(r.session_date, r.themes, null, true);
      });

      const list: Step[] = [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, b]) => ({
          key,
          month: cap(format(b.date, "MMMM", { locale: ptBR })),
          label: pickLabel(b.themes, b.count),
          count: b.count,
          sessionId: b.sessionId,
          hasRecord: b.hasRecord,
          statusSummary: STATUS_ORDER.filter((st) => (b.statuses[st] ?? 0) > 0).map(
            (st) => [st, b.statuses[st]] as [string, number],
          ),
        }));

      setSteps(list);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (steps.length === 0) return null;

  const selected = steps.find((s) => s.key === selectedKey) ?? null;

  return (
    <div>
      <h3 className="text-sm font-display font-semibold text-foreground mb-3">Linha do tempo</h3>
      <div
        className="rounded-2xl px-3 py-5 sm:px-6 overflow-x-auto"
        style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
      >
        <div className="flex items-start min-w-max sm:min-w-0">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-start">
              <button
                type="button"
                onClick={() => {
                  setSelectedKey(s.key);
                  if (!s.hasRecord) return;
                  onNavigate?.();
                  if (s.sessionId) {
                    // Abre a mesma ficha de sessão da Agenda (?edit=<sessionId>).
                    navigate(`/app/agenda?patient=${patientId}&edit=${s.sessionId}`);
                  } else {
                    navigate(`/app/agenda?patient=${patientId}&month=${s.key}`);
                  }
                }}
                aria-label={`Abrir sessão de ${s.month}`}
                className={`flex flex-col items-center text-center w-28 sm:w-32 shrink-0 rounded-xl px-1 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedKey === s.key ? "bg-muted" : ""}`}
              >
                <div
                  className="h-7 w-7 rounded-full text-primary-foreground text-xs font-semibold flex items-center justify-center shrink-0"
                  style={{
                    background:
                      s.statusSummary.length === 1 &&
                      s.statusSummary[0][0] === "completed" &&
                      s.statusSummary[0][1] === s.count
                        ? "hsl(var(--moss))"
                        : "hsl(var(--primary))",
                  }}
                >
                  {i + 1}
                </div>
                <p className="mt-2 text-xs font-display font-semibold text-foreground">{s.month}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{s.label}</p>
                {s.statusSummary.length > 0 && (
                  <div className="mt-0.5 space-y-px">
                    {s.statusSummary.map(([st, n]) => (
                      <p
                        key={st}
                        className={`text-[10px] leading-snug font-medium ${STATUS_TEXT[st] ?? "text-muted-foreground"}`}
                      >
                        {n} {(STATUS_LABEL[st] ?? st).toLowerCase()}
                        {n > 1 ? "s" : ""}
                      </p>
                    ))}
                  </div>
                )}
                {!s.hasRecord && (
                  <p className="text-[10px] text-amber-700 leading-snug mt-0.5">Sem registro</p>
                )}
              </button>
              {i < steps.length - 1 && (
                <div className="h-px flex-1 min-w-8 bg-border mt-3.5 -mx-2" aria-hidden />
              )}
            </div>
          ))}
        </div>

        {selected && !selected.hasRecord && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground sm:mr-auto">
              {selected.month} ainda não tem registro clínico.
            </p>
            <Button
              type="button"
              variant="accent"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                onNavigate?.();
                navigate(`/app/agenda?patient=${patientId}&month=${selected.key}&novo=1`);
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" /> Nova sessão
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
