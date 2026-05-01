import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Supervisionando PsiReal",
    price: "R$ 29,90",
    period: "/mês",
    description: "Para supervisionandos vinculados a uma supervisora.",
    features: [
      "Pacientes ilimitados",
      "Agenda completa",
      "Controle financeiro básico",
      "Prontuário TCC",
      "Registros de evolução",
      "Vínculo com supervisora",
    ],
    cta: "Começar agora",
    href: "https://kiwify.com.br/PLACEHOLDER_SUPERVISIONANDO",
    highlighted: false,
  },
  {
    name: "Essencial PsiReal",
    price: "R$ 39,90",
    period: "/mês",
    description: "Para quem está começando e quer organizar o consultório.",
    features: [
      "Pacientes ilimitados",
      "Agenda completa",
      "Controle financeiro básico",
      "Prontuário TCC",
      "Registros de evolução",
      "Suporte por e-mail",
    ],
    cta: "Começar agora",
    href: "https://kiwify.com.br/PLACEHOLDER_ESSENCIAL",
    highlighted: true,
  },
  {
    name: "Supervisora PsiReal",
    price: "R$ 49,90",
    period: "/mês",
    description: "Para supervisoras que acompanham supervisionandos.",
    features: [
      "Tudo do Essencial",
      "Supervisão integrada",
      "Multi-supervisionandos",
      "Painel de supervisão",
      "Financeiro completo + relatórios",
      "Suporte prioritário",
    ],
    cta: "Assinar agora",
    href: "https://kiwify.com.br/PLACEHOLDER_SUPERVISORA",
    highlighted: false,
  },
];

export const Pricing = () => {
  return (
    <section id="planos" className="py-24 lg:py-32 bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 animate-fade-up">
          <p className="text-sm font-medium tracking-wider uppercase text-accent mb-3">Planos</p>
          <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground text-balance">
            Invista na estrutura do seu consultório
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Escolha o plano que acompanha o seu momento profissional. Sem surpresas, cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-8 flex flex-col transition-all hover:-translate-y-1 ${
                plan.highlighted
                  ? "bg-card border-accent shadow-elegant scale-[1.02]"
                  : "bg-card border-border shadow-card"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-4 py-1.5 rounded-full">
                    <Sparkles className="h-3.5 w-3.5" /> Mais popular
                  </span>
                </div>
              )}

              <div className="mb-6">
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
                <Button
                  variant={plan.highlighted ? "accent" : "outline"}
                  className="w-full text-base py-5"
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
