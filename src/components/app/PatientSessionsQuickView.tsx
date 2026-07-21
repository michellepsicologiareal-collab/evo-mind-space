import { useEffect, useState } from "react";
import { format, differenceInDays, differenceInMonths, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, ChevronRight, AlertTriangle, ChevronDown, ChevronUp, Calendar, Target, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface RecordRow {
  id: string;
  session_date: string;
  session_number: number | null;
  modality: string | null;
  duration_minutes: number | null;
  chief_complaint: string | null;
  themes: string[] | null;
  clinical_observations: string | null;
  next_session_plan: string | null;
  engagement: number | null;
  risk_indicator: string | null;
  private_notes: string | null;
  created_at: string;
}

const RISK_LABEL: Record<string, string> = {
  low: "Risco baixo",
  moderate: "Risco moderado",
  high: "Risco alto",
};

interface Props {
  patientId: string;
  nextDate: Date | string | null | undefined;
  lastDate: Date | string | null | undefined;
  totalRecords: number;
  onOpenFullHistory: () => void;
}

const fmtDate = (d: Date | string | null | undefined) =>
  d ? format(typeof d === "string" ? new Date(d) : d, "dd/MM/yyyy", { locale: ptBR }) : "—";

const followUpLabel = (start: Date | null): string => {
  if (!start) return "—";
  const now = new Date();
  const days = differenceInDays(now, start);
  if (days < 0) return "—";
  if (days < 7) return days <= 1 ? "menos de 1 dia" : `${days} dias`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 semana" : `${weeks} semanas`;
  }
  const months = differenceInMonths(now, start);
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = differenceInYears(now, start);
  const remMonths = months - years * 12;
  if (remMonths === 0) return years === 1 ? "1 ano" : `${years} anos`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${remMonths} ${remMonths === 1 ? "mês" : "meses"}`;
};

const SummaryTile = ({ label, value }: { label: string; value: string }) => (
  <div
    className="rounded-xl p-3"
    style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
  >
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-display font-semibold text-foreground leading-tight">{value}</p>
  </div>
);

export const PatientSessionsQuickView = ({
  patientId,
  nextDate,
  lastDate,
  totalRecords,
  onOpenFullHistory,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [detail, setDetail] = useState<RecordRow | null>(null);
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [recentRes, firstRecordRes, firstSessionRes, patientRes] = await Promise.all([
        supabase
          .from("session_records")
          .select("id, session_date, session_number, modality, duration_minutes, chief_complaint, themes, clinical_observations, next_session_plan, engagement, risk_indicator, private_notes, created_at")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false })
          .limit(3),
        supabase
          .from("session_records")
          .select("session_date")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: true })
          .limit(1),
        supabase
          .from("sessions")
          .select("scheduled_at")
          .eq("patient_id", patientId)
          .order("scheduled_at", { ascending: true })
          .limit(1),
        supabase
          .from("patients")
          .select("treatment_start_date, created_at")
          .eq("id", patientId)
          .maybeSingle(),
      ]);
      setRecords((recentRes.data as RecordRow[]) ?? []);

      // Data de início do acompanhamento: usa treatment_start_date se definido,
      // senão a primeira sessão (registro ou agendada), senão o cadastro do paciente.
      const candidates: Array<string | null | undefined> = [
        patientRes.data?.treatment_start_date,
        firstRecordRes.data?.[0]?.session_date,
        firstSessionRes.data?.[0]?.scheduled_at,
        patientRes.data?.created_at,
      ];
      const first = candidates.find((v) => !!v) ?? null;
      setStartDate(first ? new Date(first) : null);
      setLoading(false);
    })();
  }, [patientId]);


  return (
    <div className="space-y-5">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryTile label="Próxima sessão" value={fmtDate(nextDate)} />
        <SummaryTile label="Última sessão" value={fmtDate(lastDate)} />
        <SummaryTile label="Sessões registradas" value={totalRecords > 0 ? String(totalRecords) : "—"} />
        <SummaryTile label="Em acompanhamento há" value={followUpLabel(startDate)} />
      </div>

      {/* Últimos registros de sessão */}
      <div>
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">
          Últimos registros
        </h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <FileText className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">Nenhum registro de sessão ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
              const themes = (r.themes ?? []).filter(Boolean).slice(0, 3);
              const obs = r.clinical_observations ?? "";
              const isExpanded = !!expandedObs[r.id];
              // "3 linhas" ≈ ~200 chars; use both length heuristic e line-clamp visual
              const isLong = obs.length > 200 || obs.split("\n").length > 3;

              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 space-y-4"
                  style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
                >
                  {/* 📅 Data */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <p className="text-base font-display font-semibold text-foreground leading-tight">
                        {format(new Date(r.session_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                      {r.session_number != null && (
                        <span className="text-[11px] text-muted-foreground">#{r.session_number}</span>
                      )}
                    </div>
                    {r.risk_indicator && r.risk_indicator !== "none" && RISK_LABEL[r.risk_indicator] && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-destructive/15 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {RISK_LABEL[r.risk_indicator]}
                      </span>
                    )}
                  </div>

                  {/* 📝 O que aconteceu nesta sessão */}
                  {(obs || r.chief_complaint) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">O que aconteceu nesta sessão</p>
                      {r.chief_complaint && !obs && (
                        <p className="text-sm text-foreground/90 whitespace-pre-line line-clamp-3">
                          {r.chief_complaint}
                        </p>
                      )}
                      {obs && (
                        <>
                          <p
                            className={`text-sm text-foreground/90 whitespace-pre-line ${isExpanded ? "" : "line-clamp-3"}`}
                          >
                            {obs}
                          </p>
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => setExpandedObs((s) => ({ ...s, [r.id]: !isExpanded }))}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
                              ) : (
                                <><ChevronDown className="h-3 w-3" /> Mostrar mais</>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* 🎯 Técnicas / Temas */}
                  {themes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                        <Target className="h-3 w-3" /> Técnicas / temas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {themes.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-lilac/40 text-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 📌 Combinado / Tarefa */}
                  {r.next_session_plan && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 inline-flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" /> Combinado / tarefa
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-line line-clamp-3">
                        {r.next_session_plan}
                      </p>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Abrir registro <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {records.length > 0 && (
        <button
          type="button"
          onClick={onOpenFullHistory}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            background: "hsl(var(--primary))",
            color: "#fff",
            borderRadius: 40,
            padding: "10px 16px",
            fontFamily: "Syne, sans-serif",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <FileText className="h-4 w-4" /> Ver histórico completo
        </button>
      )}

      {/* Drawer com registro completo */}
      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[560px] p-0"
          style={{ background: "hsl(var(--card))", borderLeft: "0.5px solid hsl(var(--border))" }}
        >
          <VisuallyHidden>
            <SheetTitle>Registro de sessão</SheetTitle>
            <SheetDescription>Detalhes completos do registro selecionado.</SheetDescription>
          </VisuallyHidden>
          {detail && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Registro de sessão</p>
                <h2 className="text-lg font-display font-semibold text-foreground">
                  {format(new Date(detail.session_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  {detail.session_number != null && (
                    <span className="ml-2 text-xs text-muted-foreground">Sessão #{detail.session_number}</span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground capitalize">
                  {detail.modality ?? "—"}
                  {detail.duration_minutes != null && ` · ${detail.duration_minutes} min`}
                  {detail.engagement != null && ` · Engajamento ${detail.engagement}/5`}
                </p>
              </div>

              {detail.themes && detail.themes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.themes.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {detail.chief_complaint && (
                <Section title="Queixa principal / tema">{detail.chief_complaint}</Section>
              )}
              {detail.clinical_observations && (
                <Section title="Observações clínicas">{detail.clinical_observations}</Section>
              )}
              {detail.next_session_plan && (
                <Section title="Combinado / tarefa para a próxima sessão">{detail.next_session_plan}</Section>
              )}
              {detail.private_notes && (
                <div className="rounded-lg bg-background p-3 border border-border/60">
                  <p className="text-[10px] uppercase text-muted-foreground">Notas privadas</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{detail.private_notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase text-muted-foreground">{title}</p>
    <p className="text-sm text-foreground whitespace-pre-line">{children}</p>
  </div>
);
