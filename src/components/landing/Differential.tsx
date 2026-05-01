export const Differential = () => {
  return (
    <section id="diferencial" className="py-24 lg:py-32 bg-background">
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
          </div>

          <div className="lg:col-span-7">
            <div className="relative rounded-3xl bg-gradient-card border border-border p-8 lg:p-10 shadow-soft">
              {/* Before */}
              <div className="rounded-2xl bg-muted/60 border border-border/60 p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Antes</p>
                <p className="mt-3 font-display text-2xl text-muted-foreground italic">
                  "acho que o paciente melhorou."
                </p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center my-4">
                <div className="h-10 w-px bg-gradient-to-b from-muted-foreground/40 to-accent" />
              </div>

              {/* After */}
              <div className="relative rounded-2xl bg-gradient-hero text-primary-foreground p-6 shadow-elegant">
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">Com Psi Real</p>
                <p className="mt-3 font-display text-2xl leading-snug">
                  "tenho dados consistentes que mostram <span className="font-semibold">evolução ou estagnação</span>."
                </p>
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/40 blur-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
