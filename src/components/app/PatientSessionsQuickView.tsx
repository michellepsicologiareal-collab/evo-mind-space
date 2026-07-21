import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, ChevronRight, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex items-center justify-between py-1.5 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value ?? "—"}</span>
  </div>
);

interface Props {
  patientId: string;
  nextDate: Date | string | null | undefined;
  lastDate: Date | string | null | undefined;
  totalRecords: number;
  onOpenFullHistory: () => void;
}

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("session_records")
        .select("id, session_date, session_number, modality, duration_minutes, chief_complaint, themes, clinical_observations, next_session_plan, engagement, risk_indicator, private_notes, created_at")
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false })
        .limit(5);
      setRecords((data as RecordRow[]) ?? []);
      setLoading(false);
    })();
  }, [patientId]);

  const fmt = (d: Date | string | null | undefined) =>
    d ? format(typeof d === "string" ? new Date(d) : d, "dd/MM/yyyy", { locale: ptBR }) : "—";

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div
        className="rounded-xl p-3"
        style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
      >
        <InfoRow label="Próxima sessão" value={fmt(nextDate)} />
        <InfoRow label="Última sessão" value={fmt(lastDate)} />
        <InfoRow label="Total de registros" value={totalRecords > 0 ? totalRecords : "—"} />
      </div>

      {/* Últimos registros de sessão */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Últimos registros de sessão
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
          <div className="space-y-2">
            {records.map((r) => {
              const themes = (r.themes ?? []).filter(Boolean).slice(0, 3);
              const obs = r.clinical_observations ?? "";
              const isLong = obs.length > 180;
              const isExpanded = !!expandedObs[r.id];
              const obsPreview = isLong && !isExpanded ? obs.slice(0, 180).trimEnd() + "…" : obs;

              return (
                <div
                  key={r.id}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-display font-semibold text-foreground">
                        {format(new Date(r.session_date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        {r.session_number != null && (
                          <span className="ml-2 text-[10px] text-muted-foreground">#{r.session_number}</span>
                        )}
                      </p>
                      {r.chief_complaint && (
                        <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">
                          {r.chief_complaint}
                        </p>
                      )}
                    </div>
                    {r.risk_indicator && r.risk_indicator !== "none" && RISK_LABEL[r.risk_indicator] && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-destructive/15 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {RISK_LABEL[r.risk_indicator]}
                      </span>
                    )}
                  </div>

                  {themes.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">
                        Técnicas / temas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {themes.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.next_session_plan && (
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Combinado / tarefa
                      </p>
                      <p className="text-xs text-foreground whitespace-pre-line line-clamp-3">
                        {r.next_session_plan}
                      </p>
                    </div>
                  )}

                  {obs && (
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Resumo clínico</p>
                      <p className="text-xs text-foreground whitespace-pre-line">{obsPreview}</p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setExpandedObs((s) => ({ ...s, [r.id]: !isExpanded }))}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" /> Mostrar menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" /> Mostrar mais
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Ver registro completo <ChevronRight className="h-3 w-3" />
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
