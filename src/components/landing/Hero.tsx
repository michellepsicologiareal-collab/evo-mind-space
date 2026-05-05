import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import mockupDashboard from "@/assets/mockup-dashboard.png";

export const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-soft" aria-hidden />
      <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-primary-glow/20 blur-3xl animate-float-slow" aria-hidden />
      <div className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full bg-accent/15 blur-3xl animate-float-slow" aria-hidden />

      <div className="container relative grid lg:grid-cols-12 gap-12 lg:gap-8 items-center py-20 lg:py-28">
        <div className="lg:col-span-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/60 backdrop-blur px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Gestão clínica orientada a dados — para psicólogos
          </div>

          <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-medium leading-[1.02] tracking-tight text-balance">
            Seu consultório não precisa de mais{" "}
            <span className="font-semibold text-muted-foreground">esforço</span>.
            <br />
            Precisa de <span className="text-accent font-bold">estrutura</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
            O Psi Real integra agenda, financeiro e raciocínio clínico em TCC num só ambiente.
            Saia do modo "apagando incêndio" e assuma o controle do consultório com clareza e estratégia.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button variant="hero" size="xl" asChild>
              <a href="#planos">
                Conhecer os planos <ArrowRight className="ml-1" />
              </a>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <a href="#funcionalidades">Ver funcionalidades</a>
            </Button>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 max-w-md">
            {[
              { k: "+38%", v: "faturamento real" },
              { k: "−62%", v: "faltas não previstas" },
              { k: "100%", v: "clareza clínica" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-3xl font-semibold text-primary">{s.k}</dt>
                <dd className="mt-1 text-xs text-muted-foreground leading-snug">{s.v}</dd>
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
