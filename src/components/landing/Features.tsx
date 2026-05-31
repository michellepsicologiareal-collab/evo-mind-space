import { Calendar, DollarSign, Activity, ClipboardList, TrendingUp } from "lucide-react";
import mockupAgenda from "@/assets/mockup-agenda.png";
import mockupFinanceiro from "@/assets/mockup-financeiro.png";
import mockupEmocoes from "@/assets/mockup-emocoes.png";

const features = [
  {
    icon: Calendar,
    tag: "Agenda",
    title: "Gestão de Agenda Inteligente",
    desc: "Visualização clara dos atendimentos, controle de faltas, remarcações e frequência — organizado por paciente.",
    image: mockupAgenda,
    imageAlt: "Tela de agenda do Psi Real com visualização diária e sessões do mês",
  },
  {
    icon: DollarSign,
    tag: "Financeiro",
    title: "Controle Financeiro Simplificado",
    desc: "Sessões pagas e pendentes, faturamento mensal e clareza sobre a entrada real — não só sobre a agenda cheia.",
    image: mockupFinanceiro,
    imageAlt: "Painel financeiro com faturamento, receitas e gráfico semanal",
  },
  {
    icon: Activity,
    tag: "Diferencial clínico",
    title: "Painel de Emoções & Evolução",
    desc: "Monitoramento de humor e progresso. Base para intervenções em TCC: dados → hipótese → intervenção.",
    image: mockupEmocoes,
    imageAlt: "Painel de emoções dos pacientes com histórico de humor",
    highlight: true,
  },
];

const smallFeatures = [
  {
    icon: ClipboardList,
    tag: "Clínica",
    title: "Organização Terapêutica em TCC",
    desc: "Registro estruturado de sessões, acompanhamento de metas terapêuticas e plano de tratamento claro.",
  },
  {
    icon: TrendingUp,
    tag: "Estratégia",
    title: "Visão Estratégica do Consultório",
    desc: "Pacientes ativos, taxa de faltas, crescimento mensal e onde você está perdendo dinheiro sem perceber.",
  },
];

export const Features = () => {
  return (
    <section id="funcionalidades" className="py-16 sm:py-20 lg:py-32 bg-gradient-soft">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 max-w-5xl">
          <div>
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-accent font-medium">Funcionalidades</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight text-balance">
              Tudo que seu consultório precisa,<br className="hidden lg:block" />
              <span className="font-semibold text-muted-foreground">nada que ele não precisa.</span>
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md text-sm sm:text-base">
            Um ambiente único, simples e funcional — desenhado para a prática real da psicologia clínica.
          </p>
        </div>

        {/* Featured cards with images */}
        <div className="mt-12 sm:mt-16 space-y-6 sm:space-y-8">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={`group relative overflow-hidden rounded-3xl border border-border/70 transition-all duration-500 hover:shadow-elegant ${
                f.highlight
                  ? "bg-gradient-hero text-primary-foreground border-transparent"
                  : "bg-card"
              }`}
            >
              <div className={`grid lg:grid-cols-2 gap-0 items-center ${i % 2 === 1 ? "lg:grid-flow-col-dense" : ""}`}>
                {/* Text side */}
                <div className={`p-6 sm:p-8 lg:p-12 ${i % 2 === 1 ? "lg:col-start-2" : ""}`}>
                  <div className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl ${
                    f.highlight ? "bg-primary-foreground/15 text-primary-foreground" : "bg-secondary text-primary"
                  }`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <p className={`mt-5 sm:mt-6 text-[11px] uppercase tracking-[0.18em] ${f.highlight ? "text-primary-foreground/70" : "text-accent"}`}>
                    {f.tag}
                  </p>
                  <h3 className={`mt-2 font-display text-xl sm:text-2xl lg:text-3xl font-semibold leading-snug ${f.highlight ? "" : "text-foreground"}`}>
                    {f.title}
                  </h3>
                  <p className={`mt-3 text-sm lg:text-base leading-relaxed max-w-md ${f.highlight ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                    {f.desc}
                  </p>
                </div>

                {/* Image side */}
                <div className={`relative p-4 lg:p-6 ${i % 2 === 1 ? "lg:col-start-1" : ""}`}>
                  <img
                    src={f.image}
                    alt={f.imageAlt}
                    className="w-full rounded-2xl border border-border/70 shadow-elegant"
                    loading="lazy"
                  />
                </div>
              </div>

              {f.highlight && (
                <div className="absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-accent/40 blur-3xl" aria-hidden />
              )}
            </article>
          ))}
        </div>

        {/* Smaller feature cards without images */}
        <div className="mt-6 sm:mt-8 grid sm:grid-cols-2 gap-4 sm:gap-5">
          {smallFeatures.map((f) => (
            <article
              key={f.title}
              className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <p className="mt-5 sm:mt-6 text-[11px] uppercase tracking-[0.18em] text-accent">
                {f.tag}
              </p>
              <h3 className="mt-2 font-display text-xl sm:text-2xl font-semibold leading-snug text-foreground">
                {f.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
