import mockupEmocoes from "@/assets/mockup-emocoes-v2.png";

export const Differential = () => {
  return (
    <section id="diferencial" className="py-16 sm:py-20 lg:py-32 bg-background">
      <div className="container">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Diferencial real</p>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-medium leading-tight text-balance">
              Não é só gestão.
              <br />
              É <span className="font-bold text-accent">apoio ao raciocínio clínico</span>.
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              O Psi Real estrutura dados consistentes do paciente para que você tome decisões clínicas
              com mais segurança. <strong className="text-foreground">TCC na prática:</strong> monitoramento, hipótese, ajuste.
            </p>

            <div className="mt-8 rounded-3xl bg-gradient-card border border-border p-6 shadow-soft">
              <div className="rounded-2xl bg-muted/60 border border-border/60 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Antes</p>
                <p className="mt-2 font-display text-xl text-muted-foreground font-medium">
                  "acho que o paciente melhorou."
                </p>
              </div>
              <div className="flex justify-center my-3">
                <div className="h-8 w-px bg-gradient-to-b from-muted-foreground/40 to-accent" />
              </div>
              <div className="relative rounded-2xl bg-gradient-hero text-primary-foreground p-5 shadow-elegant">
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">Com Psi Real</p>
                <p className="mt-2 font-display text-xl leading-snug">
                  "tenho dados consistentes que mostram <span className="font-semibold">evolução ou estagnação</span>."
                </p>
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-accent/40 blur-2xl" />
              </div>
            </div>
          </div>

          {/* Mockup image */}
          <div className="lg:col-span-7 animate-fade-up">
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-tr from-accent/8 via-primary/5 to-transparent rounded-[2.5rem] blur-2xl" aria-hidden />
              <img
                src={mockupEmocoes}
                alt="Painel de emoções dos pacientes com monitoramento de humor"
                className="relative w-full rounded-2xl border border-border/70 shadow-elegant"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
