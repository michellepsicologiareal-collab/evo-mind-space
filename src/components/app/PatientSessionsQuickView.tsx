import { useEffect, useState } from "react";
import { format, differenceInDays, differenceInMonths, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, ChevronRight, AlertTriangle, ChevronDown, ChevronUp, Calendar, Target, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type RecordSource = "legacy" | "v2";

interface UnifiedRecord {
  id: string;
  source: RecordSource;
  session_id: string | null;
  session_date: string; // ISO
  session_number: number | null;
  modality: string | null;
  duration_minutes: number | null;
  // conteúdo clínico (normalizado)
  chief_complaint: string | null; // legacy chief_complaint OU v2 patient_context (rótulo "Queixa/contexto")
  clinical_observations: string | null; // legacy clinical_observations OU v2 clinical_observation
  themes: string[] | null;
  emotions: string[] | null; // v2 apenas
  wellbeing_score: number | null; // v2 apenas
  engagement: number | null;
  attention_flag: string | null; // v2: none|watch|urgent; legacy: mapeado a partir de risk_indicator
  private_notes: string | null;
  // Combinado/tarefa — preparado para integração futura com session_plans
  next_session_plan: string | null; // legacy: session_records.next_session_plan; v2: sempre null por enquanto
  created_at: string;
}

const ATTENTION_LABEL: Record<string, string> = {
  watch: "Atenção",
  urgent: "Atenção urgente",
  // compat legacy
  low: "Risco baixo",
  moderate: "Risco moderado",
  high: "Risco alto",
};

// Mapeia risk_indicator (legacy) -> attention_flag equivalente para exibição unificada
const legacyRiskToAttention = (risk: string | null): string | null => {
  if (!risk || risk === "none") return null;
  if (risk === "low") return "low";
  if (risk === "moderate") return "watch";
  if (risk === "high") return "urgent";
  return risk;
};

interface Props {
  patientId: string;
  nextDate: Date | string | null | undefined;
  lastDate: Date | string | null | undefined;
  totalRecords: number;
  onOpenFullHistory: () => void;
}

// Parse "YYYY-MM-DD" como data local (evita shift de timezone que joga 19/05 para 18/05).
// Datas com horário (ISO com T ou timezone) seguem o parser padrão.
const parseSessionDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
};

const fmtDate = (d: Date | string | null | undefined) => {
  const parsed = parseSessionDate(d);
  return parsed ? format(parsed, "dd/MM/yyyy", { locale: ptBR }) : "—";
};

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

const normalizeEmotions = (raw: unknown): string[] | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map((e) => (typeof e === "string" ? e : (e as any)?.label ?? String(e))).filter(Boolean);
  if (typeof raw === "object") {
    const arr = Object.values(raw as Record<string, unknown>);
    return arr.map((e) => (typeof e === "string" ? e : (e as any)?.label ?? String(e))).filter(Boolean);
  }
  return null;
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

const SourceBadge = ({ source }: { source: RecordSource }) => (
  <span
    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
      source === "v2"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground"
    }`}
    title={source === "v2" ? "Registro do novo fluxo (Agenda → Editar sessão)" : "Registro legado (RegistroSessao)"}
  >
    {source === "v2" ? "v2" : "Legado"}
  </span>
);

export const PatientSessionsQuickView = ({
  patientId,
  nextDate,
  lastDate,
  totalRecords,
  onOpenFullHistory,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [detail, setDetail] = useState<UnifiedRecord | null>(null);
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [legacyRes, v2Res, firstRecordRes, firstSessionRes, patientRes] = await Promise.all([
        // 1) Legado — leitura apenas
        supabase
          .from("session_records")
          .select("id, session_id, session_date, session_number, modality, duration_minutes, chief_complaint, themes, clinical_observations, next_session_plan, engagement, risk_indicator, private_notes, created_at")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false })
          .limit(15),
        // 2) Novo fluxo — patient_progress + metadata da sessão
        // Filtro trata data_model NULL: aceita NULL OU diferente de 'legacy_unclassified'
        supabase
          .from("patient_progress")
          .select("id, session_id, recorded_at, created_at, wellbeing_score, patient_context, clinical_observation, emotions, themes, engagement, attention_flag, private_notes, data_model, sessions:session_id(scheduled_at, modality, duration_minutes)")
          .eq("patient_id", patientId)
          .or("data_model.is.null,data_model.neq.legacy_unclassified")
          .order("recorded_at", { ascending: false })
          .limit(15),
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

      const legacyRows = (legacyRes.data ?? []) as any[];
      const v2Rows = (v2Res.data ?? []) as any[];

      // Set de session_id cobertos por registros v2 — usado para deduplicar legado
      const v2SessionIds = new Set(
        v2Rows.map((r) => r.session_id).filter((sid): sid is string => !!sid)
      );

      const legacyUnified: UnifiedRecord[] = legacyRows
        .filter((r) => !(r.session_id && v2SessionIds.has(r.session_id)))
        .map((r) => ({
          id: `legacy:${r.id}`,
          source: "legacy" as const,
          session_id: r.session_id ?? null,
          session_date: r.session_date,
          session_number: r.session_number ?? null,
          modality: r.modality ?? null,
          duration_minutes: r.duration_minutes ?? null,
          chief_complaint: r.chief_complaint ?? null,
          clinical_observations: r.clinical_observations ?? null,
          themes: r.themes ?? null,
          emotions: null,
          wellbeing_score: null,
          engagement: r.engagement ?? null,
          attention_flag: legacyRiskToAttention(r.risk_indicator ?? null),
          private_notes: r.private_notes ?? null,
          next_session_plan: r.next_session_plan ?? null,
          created_at: r.created_at,
        }));

      const v2Unified: UnifiedRecord[] = v2Rows.map((r) => {
        const sess = r.sessions ?? null;
        return {
          id: `v2:${r.id}`,
          source: "v2" as const,
          session_id: r.session_id ?? null,
          session_date: sess?.scheduled_at ?? r.recorded_at ?? r.created_at,
          session_number: null,
          modality: sess?.modality ?? null,
          duration_minutes: sess?.duration_minutes ?? null,
          chief_complaint: r.patient_context ?? null,
          clinical_observations: r.clinical_observation ?? null,
          themes: r.themes ?? null,
          emotions: normalizeEmotions(r.emotions),
          wellbeing_score: r.wellbeing_score ?? null,
          engagement: r.engagement ?? null,
          attention_flag: r.attention_flag && r.attention_flag !== "none" ? r.attention_flag : null,
          private_notes: r.private_notes ?? null,
          // Bloco Combinado/tarefa fica oculto para v2 até integração com session_plans
          next_session_plan: null,
          created_at: r.created_at,
        };
      });

      const merged = [...v2Unified, ...legacyUnified]
        .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
        .slice(0, 3);

      setRecords(merged);

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
              const isLong = obs.length > 200 || obs.split("\n").length > 3;
              const attentionLabel = r.attention_flag ? ATTENTION_LABEL[r.attention_flag] : null;

              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 space-y-4"
                  style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
                >
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="h-4 w-4 text-primary" />
                      <p className="text-base font-display font-semibold text-foreground leading-tight">
                        {format(new Date(r.session_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                      {r.session_number != null && (
                        <span className="text-[11px] text-muted-foreground">#{r.session_number}</span>
                      )}
                      <SourceBadge source={r.source} />
                      {r.source === "v2" && r.wellbeing_score != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Bem-estar {r.wellbeing_score}/10
                        </span>
                      )}
                    </div>
                    {attentionLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-destructive/15 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {attentionLabel}
                      </span>
                    )}
                  </div>

                  {/* Queixa/contexto + Observação clínica */}
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

                  {/* Temas */}
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

                  {/* Combinado / Tarefa — legado somente (v2 oculto até integração com session_plans) */}
                  {r.source === "legacy" && r.next_session_plan && (
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] uppercase text-muted-foreground">Registro de sessão</p>
                  <SourceBadge source={detail.source} />
                </div>
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
                  {detail.source === "v2" && detail.wellbeing_score != null && ` · Bem-estar ${detail.wellbeing_score}/10`}
                </p>
              </div>

              {detail.themes && detail.themes.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Temas</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.themes.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.emotions && detail.emotions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Emoções observadas</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.emotions.map((e) => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.chief_complaint && (
                <Section title="Queixa / contexto trazido">{detail.chief_complaint}</Section>
              )}
              {detail.clinical_observations && (
                <Section title="Observação clínica">{detail.clinical_observations}</Section>
              )}

              {detail.attention_flag && ATTENTION_LABEL[detail.attention_flag] && (
                <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                  <p className="text-[10px] uppercase text-destructive">Atenção clínica</p>
                  <p className="text-sm text-foreground">{ATTENTION_LABEL[detail.attention_flag]}</p>
                </div>
              )}

              {detail.source === "legacy" && detail.next_session_plan && (
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
