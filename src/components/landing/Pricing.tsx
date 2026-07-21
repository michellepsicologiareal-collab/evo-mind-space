import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const plan = {
  name: "PsiReal",
  price: "R$ 15,90",
  period: "/mês",
  description: "Tudo que você precisa para organizar seu consultório com clareza.",
  features: [
    "Pacientes ilimitados",
    "Agenda completa",
    "Controle financeiro",
    "Prontuário TCC",
    "Registros de evolução",
    "Espaço de Autocuidado",
    "Suporte por e-mail",
  ],
  cta: "Começar teste grátis",
  href: "https://pay.kiwify.com.br/gRIR9My",
};

export const Pricing = () => {
  return (
    <section id="planos" className="py-16 sm:py-20 lg:py-32 bg-background">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16 animate-fade-up">
          <p className="text-sm font-medium tracking-wider uppercase text-accent mb-3">Plano</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-foreground text-balance">
            PsiReal por R$ 15,90/mês
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Teste grátis por 14 dias. Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="relative rounded-3xl border border-accent bg-card p-6 sm:p-8 flex flex-col shadow-elegant transition-all hover:-translate-y-1">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-4 py-1.5 rounded-full">
                <Sparkles className="h-3.5 w-3.5" /> 14 dias grátis
              </span>
            </div>

            <div className="mb-6 mt-2">
              <h3 className="font-display text-2xl font-medium text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            </div>

            <div className="mb-6">
              <span className="font-display text-4xl font-semibold text-foreground">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <a href={plan.href} target="_blank" rel="noopener noreferrer" className="mt-auto">
              <Button variant="accent" className="w-full text-base py-5" size="lg">
                {plan.cta}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
