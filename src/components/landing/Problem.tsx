import { CalendarX, LineChart, Wallet, Brain } from "lucide-react";

const pains = [
  { icon: CalendarX, title: "Agenda desorganizada", desc: "Faltas, remarcações e horários soltos que drenam sua energia toda semana." },
  { icon: Wallet, title: "Sem controle financeiro", desc: "Agenda cheia, mas sem clareza do que entrou de verdade no caixa." },
  { icon: LineChart, title: "Evolução nebulosa", desc: "Difícil acompanhar progresso real do paciente — fica no 'achismo'." },
  { icon: Brain, title: "Trabalha muito, cresce pouco", desc: "Falta visão estratégica para escalar com sustentabilidade." },
];

export const Problem = () => {
  return (
    <section id="problema" className="py-24 lg:py-32 bg-background">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">O problema</p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-medium leading-tight text-balance">
            A maioria dos psicólogos sofre — em silêncio — com os mesmos quatro problemas.
          </h2>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pains.map((p) => (
            <div
              key={p.title}
              className="group relative rounded-2xl border border-border bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
