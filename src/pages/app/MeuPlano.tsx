import { useNavigate } from "react-router-dom";
import {
  Crown,
  Check,
  Sparkles,
  ArrowRight,
  Loader2,
  Calendar,
  CreditCard,
  CalendarCheck,
  CalendarClock,
  StickyNote,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { useSubscription, useKiwifyLink } from "@/hooks/useSubscription";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  FREE_PLAN_NAME,
  formatPlanDate,
  isProblemStatus,
} from "@/lib/subscription";

const planFeatures = [
  "Pacientes ilimitados",
  "Agenda completa com lembretes",
  "Controle financeiro avançado",
  "Prontuário TCC e registros de evolução",
  "Espaço de Autocuidado do Terapeuta",
  "Supervisão e supervisionandos",
  "Suporte prioritário",
];

export default function MeuPlano() {
  const { status, isPremium, plan, loading } = useSubscription();
  const { url: kiwifyUrl } = useKiwifyLink();
  const navigate = useNavigate();

  const openCheckout = () => {
    window.open(kiwifyUrl, "_blank", "noopener,noreferrer");
  };

  const isFree = status === "free";
  const planLabel = isFree ? FREE_PLAN_NAME : plan.planName || FREE_PLAN_NAME;

  const details = [
    { icon: Calendar, label: "Início da assinatura", value: formatPlanDate(plan.startedAt) },
    { icon: CalendarCheck, label: "Último pagamento", value: formatPlanDate(plan.lastPaymentAt) },
    { icon: CalendarClock, label: "Próxima renovação", value: formatPlanDate(plan.nextRenewalAt) },
  ].filter((d) => !!d.value);

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <PageHeader title="Meu Plano" subtitle="Acompanhe sua assinatura e acesso ao PsiReal" />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Status atual */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Plano atual
              </p>
              {loading ? (
                <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                <>
                  <h2 className="mt-3 font-display text-2xl sm:text-3xl font-semibold text-foreground break-words">
                    {planLabel}
                  </h2>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
                  >
                    {status === "active" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isProblemStatus(status) ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Crown className="h-3.5 w-3.5" />
                    )}
                    {isFree ? "Ativo" : STATUS_LABELS[status]}
                  </span>
                  {isFree && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sua conta gratuita está ativa.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          {!loading && !isFree && details.length > 0 && (
            <div className="mt-6 space-y-3">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-4">
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !isFree && plan.notes && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <StickyNote className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Observação</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line break-words">
                  {plan.notes}
                </p>
              </div>
            </div>
          )}

          {!loading && isFree && (
            <div className="mt-6 space-y-4 rounded-2xl bg-accent/8 p-4 border border-accent/20">
              <p className="text-sm text-foreground/90">
                Você está no plano gratuito. Assine o PsiReal Mensal para liberar todos os recursos.
              </p>
              <Button variant="accent" className="w-full" onClick={openCheckout}>
                <CreditCard className="h-4 w-4 mr-1" />
                Assinar PsiReal
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {!loading && isProblemStatus(status) && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Identificamos uma pendência na sua assinatura ({STATUS_LABELS[status].toLowerCase()}).
              Assim que o pagamento for confirmado, atualizamos seu acesso manualmente.
            </div>
          )}
        </section>

        {/* Plano pago */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-accent bg-card p-6 sm:p-8 shadow-elegant">
          <div className="absolute -top-3 left-6">
            <span className="inline-flex items-center gap-1 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
              <Sparkles className="h-3 w-3" /> Recomendado
            </span>
          </div>

          <div className="mt-4">
            <h3 className="font-display text-2xl font-semibold text-foreground">PsiReal Mensal</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tudo que você precisa para organizar seu consultório com clareza.
            </p>
          </div>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-display text-4xl sm:text-5xl font-bold text-foreground">R$ 15,90</span>
            <span className="text-muted-foreground">/mês</span>
          </div>

          <ul className="mt-6 space-y-3">
            {planFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-3">
            <Button variant="accent" size="lg" className="w-full" onClick={openCheckout}>
              <CreditCard className="h-4 w-4 mr-1" />
              {isPremium ? "Gerenciar assinatura" : "Assinar mensalmente"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pagamento seguro via Kiwify · Cancele quando quiser
            </p>
          </div>
        </section>
      </div>

      {/* Informações adicionais */}
      <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <h3 className="font-display text-lg font-semibold text-foreground">Dúvidas sobre sua assinatura?</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          O pagamento é processado com segurança pela Kiwify. Após a confirmação, sua assinatura é
          liberada pela nossa equipe. Para cancelamentos ou reembolsos, entre em contato pelo WhatsApp
          de suporte.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" size="sm" onClick={openCheckout}>
            Acessar checkout
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/perfil")}>
            Ir para Configurações
          </Button>
        </div>
      </section>
    </div>
  );
}
