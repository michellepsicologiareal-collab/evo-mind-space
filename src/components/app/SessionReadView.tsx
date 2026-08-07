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

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value || !String(value).trim()) return null;
  return (
    <div className="break-inside-avoid">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-3xl h-[92dvh] p-0 gap-0 overflow-hidden">
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

        <div className="overflow-y-auto px-4 py-5 sm:px-10 sm:py-8 bg-muted/30 print:bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <article className="mx-auto max-w-[42rem] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10 print:border-0 print:shadow-none">
              <header className="border-b border-border pb-4">
                <h1 className="font-display text-xl font-semibold text-foreground">{patientName || "Paciente"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {date ? format(date, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Data não informada"}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  {props.serviceName && <span>{props.serviceName}</span>}
                  {props.durationMinutes ? <span>{props.durationMinutes} min</span> : null}
                  {props.modality && <span>{props.modality === "online" ? "Online" : "Presencial"}</span>}
                  {props.status && <span>{STATUS_LABEL[props.status] ?? props.status}</span>}
                  {props.price != null && (
                    <span>
                      R$ {Number(props.price).toFixed(2).replace(".", ",")}
                      {props.paymentStatus ? ` · ${PAYMENT_LABEL[props.paymentStatus] ?? props.paymentStatus}` : ""}
                    </span>
                  )}
                </div>
              </header>

              <div className="mt-6 space-y-6">
                {progress?.wellbeing_score != null && (
                  <Field
                    label="Bem-estar"
                    value={`${progress.wellbeing_score}/10${progress.wellbeing_source ? ` (${progress.wellbeing_source === "patient" ? "relato do paciente" : "observação clínica"})` : ""}`}
                  />
                )}
                {emotions.length > 0 && <Field label="Emoções" value={emotions.join(" · ")} />}
                {themes.length > 0 && <Field label="Temas" value={themes.join(" · ")} />}
                {typeof progress?.engagement === "number" && <Field label="Engajamento" value={`${progress.engagement}/5`} />}
                <Field label="Contexto do paciente" value={progress?.patient_context} />
                <Field label="Observação clínica" value={progress?.clinical_observation} />
                <Field label="Registro (legado)" value={progress?.note} />
                <Field label="Notas privadas" value={progress?.private_notes} />
                <Field label="Observações da sessão" value={props.notes} />

                {homework && (
                  <section className="rounded-lg border border-border bg-muted/40 p-4 print:bg-white">
                    <p className="font-display text-sm font-semibold text-foreground">
                      Plano entre sessões{homework.sent_at ? " · enviado" : ""}
                    </p>
                    <div className="mt-3 space-y-4">
                      <Field label="Título" value={homework.title} />
                      <Field label="Pontos da sessão" value={homework.session_points} />
                      <Field label="Meta da semana" value={homework.weekly_goal} />
                      <Field label="Observações" value={homework.weekly_observations} />
                      <Field label={homework.coping_card_title || "Cartão de enfrentamento"} value={homework.coping_card_content} />
                      <Field label="Conteúdo" value={homework.content} />
                    </div>
                  </section>
                )}

                {!progress && !homework && !props.notes && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ainda não há registro clínico para esta sessão.
                  </p>
                )}
              </div>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SessionReadView;
