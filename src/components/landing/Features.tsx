import { Calendar, DollarSign, Activity, ClipboardList, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Calendar,
    tag: "Agenda",
    title: "Gestão de Agenda Inteligente",
    desc: "Visualização clara dos atendimentos, controle de faltas, remarcações e frequência — organizado por paciente.",
    span: "lg:col-span-2",
  },
  {
    icon: DollarSign,
    tag: "Financeiro",
    title: "Controle Financeiro Simplificado",
    desc: "Sessões pagas e pendentes, faturamento mensal e clareza sobre a entrada real — não só sobre a agenda cheia.",
    span: "lg:col-span-1",
  },
  {
    icon: Activity,
    tag: "Diferencial clínico",
    title: "Painel de Emoções & Evolução",
    desc: "Monitoramento de humor e progresso. Base para intervenções em TCC: dados → hipótese → intervenção.",
    span: "lg:col-span-1",
    highlight: true,
  },
  {
    icon: ClipboardList,
    tag: "Clínica",
    title: "Organização Terapêutica em TCC",
    desc: "Registro estruturado de sessões, acompanhamento de metas terapêuticas e plano de tratamento claro.",
    span: "lg:col-span-1",
  },
  {
    icon: TrendingUp,
    tag: "Estratégia",
    title: "Visão Estratégica do Consultório",
    desc: "Pacientes ativos, taxa de faltas, crescimento mensal e onde você está perdendo dinheiro sem perceber.",
    span: "lg:col-span-1",
  },
];

export const Features = () => {
  return (
    <section id="funcionalidades" className="py-24 lg:py-32 bg-gradient-soft">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 max-w-5xl">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Funcionalidades</p>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-medium leading-tight text-balance">
              Tudo que seu consultório precisa,<br className="hidden lg:block" />
              <span className="italic text-muted-foreground">nada que ele não precisa.</span>
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md">
            Um ambiente único, simples e funcional — desenhado para a prática real da psicologia clínica.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <article
              key={f.title}
              className={`${f.span} group relative overflow-hidden rounded-3xl border border-border/70 p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-elegant ${
                f.highlight
                  ? "bg-gradient-hero text-primary-foreground border-transparent"
                  : "bg-card"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                f.highlight ? "bg-primary-foreground/15 text-primary-foreground" : "bg-secondary text-primary"
              }`}>
                <f.icon className="h-5 w-5" />
              </div>
              <p className={`mt-6 text-[11px] uppercase tracking-[0.18em] ${f.highlight ? "text-primary-foreground/70" : "text-accent"}`}>
                {f.tag}
              </p>
              <h3 className={`mt-2 font-display text-2xl font-semibold leading-snug ${f.highlight ? "" : "text-foreground"}`}>
                {f.title}
              </h3>
              <p className={`mt-3 text-sm leading-relaxed ${f.highlight ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                {f.desc}
              </p>

              {f.highlight && (
                <div className="absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-accent/40 blur-3xl" aria-hidden />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
