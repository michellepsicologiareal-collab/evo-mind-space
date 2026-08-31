import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Check, Sparkles, ArrowRight, Loader2, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, type SubscriptionStatus } from "@/hooks/useSubscription";

const KIWIFY_LINK = "https://pay.kiwify.com.br/k4VMHLa";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  free: "Gratuito",
  pending: "Pendente",
  active: "Ativo",
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  free: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
};

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
  const { user } = useAuth();
  const { status, isPremium, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) {
      setFetching(false);
      return;
    }
    supabase
      .from("profiles")
      .select("subscription_ends_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setEndsAt(data?.subscription_ends_at ?? null);
        setFetching(false);
      });
  }, [user]);

  const openCheckout = () => {
    window.open(KIWIFY_LINK, "_blank", "noopener,noreferrer");
  };

  const isLoading = subLoading || fetching;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <PageHeader
        title="Meu Plano"
        subtitle="Gerencie sua assinatura e acesso ao PsiReal"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Status atual */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Status da assinatura
              </p>
              {isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                <>
                  <h2 className="mt-3 font-display text-2xl sm:text-3xl font-semibold text-foreground">
                    {isPremium ? "Essencial PsiReal" : "PsiReal Gratuito"}
                  </h2>
                  <span
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    {STATUS_LABELS[status]}
                  </span>
                </>
              )}
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          {!isLoading && endsAt && status === "active" && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary/50 p-4">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Próxima renovação</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(endsAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isPremium && (
            <div className="mt-6 rounded-2xl bg-accent/8 p-4 border border-accent/20">
              <p className="text-sm text-foreground/90">
                Você está no plano gratuito. Assine o Essencial PsiReal para liberar todos os recursos.
              </p>
            </div>
          )}
        </section>

        {/* Plano Essencial */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-accent bg-card p-6 sm:p-8 shadow-elegant">
          <div className="absolute -top-3 left-6">
            <span className="inline-flex items-center gap-1 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
              <Sparkles className="h-3 w-3" /> Recomendado
            </span>
          </div>

          <div className="mt-4">
            <h3 className="font-display text-2xl font-semibold text-foreground">Essencial PsiReal</h3>
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
              {isPremium ? "Gerenciar assinatura" : "Assinar agora"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Teste grátis por 14 dias · Cancele quando quiser
            </p>
          </div>
        </section>
      </div>

      {/* Informações adicionais */}
      <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <h3 className="font-display text-lg font-semibold text-foreground">Dúvidas sobre sua assinatura?</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          O pagamento é processado de forma segura pela Kiwify. Após a confirmação, seu acesso premium é
          liberado automaticamente. Para cancelamentos ou reembolsos, entre em contato pelo WhatsApp de
          suporte.
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
