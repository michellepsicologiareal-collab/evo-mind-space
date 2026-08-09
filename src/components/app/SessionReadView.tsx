import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SessionReadViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  patientId?: string | null;
  patientName?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
  modality?: string | null;
  price?: number | null;
  paymentStatus?: string | null;
  notes?: string | null;
  serviceName?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  cancelled: "Cancelada",
  rescheduled: "Remarcada",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  exempt: "Isento",
};

function hasText(v?: string | null) {
  return !!v && !!String(v).trim();
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!hasText(value)) return null;
  return (
    <div className="doc-field min-w-0">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.08em] text-muted-foreground break-words">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] hyphens-auto text-[13.5px] leading-6 sm:text-[15px] sm:leading-7 text-foreground">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="doc-section min-w-0">
      <h2 className="font-display text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.1em] text-foreground/70 break-words">{title}</h2>
      <div className="mt-3 border-t border-border pt-4 space-y-4 sm:space-y-5">{children}</div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value?: string | null }) {
  if (!hasText(value)) return null;
  return (
    <div className="doc-field min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground break-words">{label}</p>
      <p className="mt-0.5 text-[13px] sm:text-sm font-medium text-foreground break-words [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}


export function SessionReadView(props: SessionReadViewProps) {
  const { open, onOpenChange, sessionId, patientName, scheduledAt } = props;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [homework, setHomework] = useState<any>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: prog }, { data: hw }] = await Promise.all([
        (supabase as any).from("patient_progress")
          .select("mood_score, note, wellbeing_score, wellbeing_source, patient_context, clinical_observation, emotions, attention_flag, themes, engagement, private_notes")
          .eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("homework_tasks")
          .select("title, content, session_points, weekly_goal, weekly_observations, coping_card_title, coping_card_content, sent_at")
          .eq("session_id", sessionId).eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setProgress(prog ?? null);
      setHomework(hw ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, sessionId]);

  const date = scheduledAt ? new Date(scheduledAt) : null;
  const emotions: string[] = Array.isArray(progress?.emotions)
    ? progress.emotions.map((e: any) => (typeof e === "string" ? e : e?.label)).filter(Boolean)
    : [];
  const themes: string[] = Array.isArray(progress?.themes) ? progress.themes.filter((t: any) => typeof t === "string") : [];

  const hasIndicators =
    progress?.wellbeing_score != null || emotions.length > 0 || themes.length > 0 || typeof progress?.engagement === "number";
  const hasRecord =
    hasText(progress?.patient_context) || hasText(progress?.clinical_observation) ||
    hasText(progress?.note) || hasText(props.notes);
  const hasHomework =
    homework && (hasText(homework.title) || hasText(homework.session_points) || hasText(homework.weekly_goal) ||
      hasText(homework.weekly_observations) || hasText(homework.coping_card_content) || hasText(homework.content));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:left-1/2 sm:top-1/2 sm:h-[92dvh] sm:w-[96vw] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6 print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-display text-base sm:text-lg truncate">Resumo da sessão</DialogTitle>
              <DialogDescription className="text-xs truncate">
                {patientName || "Paciente"}
                {date ? ` · ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : ""}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 mr-6" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Imprimir / PDF</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-10 sm:py-8 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <article
              id="session-doc"
              className="mx-auto w-full max-w-[44rem] break-words rounded-xl border border-border bg-card p-4 shadow-sm sm:p-12"
            >

              <header className="pb-5 sm:pb-6">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.14em] text-muted-foreground">
                  Registro de sessão
                </p>
                <h1 className="mt-2 font-display text-xl sm:text-2xl font-semibold leading-tight text-foreground break-words [overflow-wrap:anywhere]">
                  {patientName || "Paciente"}
                </h1>
                <p className="mt-1 text-[13px] sm:text-sm text-muted-foreground break-words">
                  {date
                    ? format(date, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                    : "Data não informada"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:mt-5 sm:gap-x-6 sm:gap-y-4 sm:grid-cols-4">

                  <MetaItem label="Serviço" value={props.serviceName} />
                  <MetaItem label="Duração" value={props.durationMinutes ? `${props.durationMinutes} min` : null} />
                  <MetaItem label="Modalidade" value={props.modality ? (props.modality === "online" ? "Online" : "Presencial") : null} />
                  <MetaItem label="Status" value={props.status ? STATUS_LABEL[props.status] ?? props.status : null} />
                  <MetaItem
                    label="Valor"
                    value={props.price != null ? `R$ ${Number(props.price).toFixed(2).replace(".", ",")}` : null}
                  />
                  <MetaItem
                    label="Pagamento"
                    value={props.paymentStatus ? PAYMENT_LABEL[props.paymentStatus] ?? props.paymentStatus : null}
                  />
                </div>
              </header>

              <div className="space-y-7 sm:space-y-9">
                {hasIndicators && (
                  <Section title="Indicadores">
                    {progress?.wellbeing_score != null && (
                      <Field
                        label="Bem-estar"
                        value={`${progress.wellbeing_score}/10${progress.wellbeing_source ? ` (${progress.wellbeing_source === "patient" ? "relato do paciente" : "observação clínica"})` : ""}`}
                      />
                    )}
                    {typeof progress?.engagement === "number" && <Field label="Engajamento" value={`${progress.engagement}/5`} />}
                    {emotions.length > 0 && <Field label="Emoções" value={emotions.join(" · ")} />}
                    {themes.length > 0 && <Field label="Temas" value={themes.join(" · ")} />}
                  </Section>
                )}

                {hasRecord && (
                  <Section title="Registro clínico">
                    <Field label="Contexto do paciente" value={progress?.patient_context} />
                    <Field label="Observação clínica" value={progress?.clinical_observation} />
                    <Field label="Registro (legado)" value={progress?.note} />
                    <Field label="Observações da sessão" value={props.notes} />
                  </Section>
                )}

                {hasText(progress?.private_notes) && (
                  <Section title="Notas privadas">
                    <Field label="Uso interno" value={progress?.private_notes} />
                  </Section>
                )}

                {hasHomework && (
                  <Section title={`Plano entre sessões${homework.sent_at ? " · enviado" : ""}`}>
                    <Field label="Título" value={homework.title} />
                    <Field label="Pontos da sessão" value={homework.session_points} />
                    <Field label="Meta da semana" value={homework.weekly_goal} />
                    <Field label="Observações" value={homework.weekly_observations} />
                    <Field label={homework.coping_card_title || "Cartão de enfrentamento"} value={homework.coping_card_content} />
                    <Field label="Conteúdo" value={homework.content} />
                  </Section>
                )}

                {!hasIndicators && !hasRecord && !hasHomework && !hasText(progress?.private_notes) && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Ainda não há registro clínico para esta sessão.
                  </p>
                )}
              </div>

              <footer className="mt-10 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                Documento gerado pelo Psi Real — uso clínico exclusivo e confidencial.
              </footer>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SessionReadView;
