import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
  return (
    <section id="cta" className="py-24 lg:py-32 bg-background">
      <div className="container">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-hero px-8 py-20 lg:px-20 lg:py-28 text-primary-foreground shadow-elegant">
          <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-primary-glow/40 blur-3xl" aria-hidden />

          <div className="relative max-w-3xl">
            <p className="text-xs uppercase tracking-[0.25em] text-primary-foreground/70">Comece hoje</p>
            <h2 className="mt-4 font-display text-4xl lg:text-6xl font-medium leading-[1.05] text-balance">
              Transforme dados em decisões.
              <br />
              <span className="italic text-accent">E o seu consultório, em estratégia.</span>
            </h2>
            <p className="mt-6 text-lg text-primary-foreground/85 max-w-xl">
              Comece gratuitamente. Sem cartão de crédito. Em poucos minutos seu consultório passa a operar com clareza.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button variant="accent" size="xl">
                Criar minha conta <ArrowRight />
              </Button>
              <Button
                variant="outline"
                size="xl"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Falar com a equipe
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
