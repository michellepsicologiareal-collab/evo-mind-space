import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import mockupDashboard from "@/assets/mockup-dashboard.png";

export const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-soft" aria-hidden />
      <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-primary-glow/20 blur-3xl animate-float-slow" aria-hidden />
      <div className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full bg-accent/15 blur-3xl animate-float-slow" aria-hidden />

      <div className="container relative grid lg:grid-cols-12 gap-10 lg:gap-8 items-center py-14 sm:py-20 lg:py-28">
        <div className="lg:col-span-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/60 backdrop-blur px-3 py-1.5 text-[11px] sm:text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="leading-snug">Gestão clínica orientada a dados — para psicólogos</span>
          </div>

          <h1 className="mt-5 sm:mt-6 font-display text-[2.25rem] sm:text-5xl lg:text-7xl font-medium leading-[1.05] tracking-tight text-balance">
            Seu consultório não precisa de mais{" "}
            <span className="font-semibold text-muted-foreground">esforço</span>.
            <br />
            Precisa de <span className="text-accent font-bold">estrutura</span>.
          </h1>

          <p className="mt-5 max-w-xl text-base sm:text-lg text-muted-foreground text-pretty">
            O Psi Real integra agenda, financeiro e raciocínio clínico em TCC num só ambiente.
            Saia do modo "apagando incêndio" e assuma o controle do consultório com clareza e estratégia.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            <Button variant="hero" size="xl" asChild className="w-full sm:w-auto">
              <a href="/auth?tab=signup">
                Começar meus 14 dias grátis <ArrowRight className="ml-1" />
              </a>
            </Button>
            <Button variant="outline" size="xl" asChild className="w-full sm:w-auto">
              <a href="#funcionalidades">Ver funcionalidades</a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem cartão de crédito · Cancele quando quiser · Acesso completo por 14 dias
          </p>
          <a
            href="/auth?tab=signup"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            Clique e crie sua conta grátis — leva menos de 1 minuto.
          </a>

          <dl className="mt-10 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-6 max-w-md">
            {[
              { k: "+38%", v: "faturamento real" },
              { k: "−62%", v: "faltas não previstas" },
              { k: "100%", v: "clareza clínica" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-2xl sm:text-3xl font-semibold text-primary">{s.k}</dt>
                <dd className="mt-1 text-[11px] sm:text-xs text-muted-foreground leading-snug">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Hero mockup image */}
        <div className="lg:col-span-6 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent rounded-[2rem] blur-2xl" aria-hidden />
            <img
              src={mockupDashboard}
              alt="Painel do Psi Real mostrando visão geral do consultório"
              className="relative w-full rounded-2xl shadow-elegant"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
