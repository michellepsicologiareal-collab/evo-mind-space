import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
  return (
    <section id="cta" className="py-16 sm:py-20 lg:py-32 bg-background">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-hero px-6 py-14 sm:px-8 sm:py-20 lg:px-20 lg:py-28 text-primary-foreground shadow-elegant">
          <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-primary-glow/40 blur-3xl" aria-hidden />

          <div className="relative max-w-3xl">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-primary-foreground/70">Comece hoje</p>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-6xl font-medium leading-[1.08] text-balance">
              Transforme dados em decisões.
              <br />
              <span className="font-bold text-accent">E o seu consultório, em estratégia.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-primary-foreground/85 max-w-xl">
              Escolha o plano ideal para o seu momento e comece a organizar seu consultório com clareza e estratégia.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Button variant="accent" size="xl" asChild className="w-full sm:w-auto">
                <a href="/auth">Criar minha conta <ArrowRight /></a>
              </Button>
              <Button
                variant="outline"
                size="xl"
                className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <a
                  href="https://wa.me/5511947388423?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20Psi%20Real"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar com a equipe
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
