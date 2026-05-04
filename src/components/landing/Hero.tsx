import heroImg from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-soft" aria-hidden />
      <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-primary-glow/20 blur-3xl animate-float-slow" aria-hidden />
      <div className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full bg-accent/15 blur-3xl animate-float-slow" aria-hidden />

      <div className="container relative grid lg:grid-cols-12 gap-12 lg:gap-8 items-center py-20 lg:py-28">
        <div className="lg:col-span-7 animate-fade-up">
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

        <div className="lg:col-span-5 relative">
          <div className="relative rounded-[2rem] overflow-hidden shadow-elegant ring-1 ring-primary/10">
            <img
              src={heroImg}
              alt="Psi Real — visualização abstrata de dados clínicos, agenda e evolução emocional"
              width={1536}
              height={1280}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent" />
          </div>

          {/* Floating cards */}
          <div className="absolute -left-6 top-10 hidden md:block animate-float-slow">
            <div className="rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-soft px-5 py-4 w-56">
              <p className="text-xs text-muted-foreground">Humor médio · Maria S.</p>
              <p className="font-display text-2xl font-semibold text-primary mt-1">7,4 / 10</p>
              <div className="mt-2 flex gap-1">
                {[3,5,4,6,7,7,8].map((h,i)=>(
                  <span key={i} className="flex-1 rounded-sm bg-primary-glow/60" style={{height: `${h*4}px`}} />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -right-4 -bottom-6 hidden md:block animate-float-slow" style={{ animationDelay: "1.2s" }}>
            <div className="rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-soft px-5 py-4 w-60">
              <p className="text-xs text-muted-foreground">Faturamento — Outubro</p>
              <p className="font-display text-2xl font-semibold text-primary mt-1">R$ 12.480</p>
              <p className="text-xs text-accent mt-1">↑ 18% vs. setembro</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
