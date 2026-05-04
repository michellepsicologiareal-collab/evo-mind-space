import { Check } from "lucide-react";

const audience = [
  "Psicólogos clínicos — do iniciante ao avançado",
  "Supervisoras que acompanham supervisionandos e precisam de registro estruturado",
  "Profissionais que querem escalar com organização e clareza financeira",
  "Quem trabalha muito mas não tem visibilidade real dos números",
  "Psis que querem integrar clínica + gestão + supervisão sem complicação",
  "Profissionais comprometidos com as diretrizes do CRP e LGPD",
];

export const ForWhom = () => {
  return (
    <section id="para-quem" className="py-24 lg:py-32 bg-gradient-soft">
      <div className="container grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Para quem é</p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-medium leading-tight text-balance">
            Feito para psicólogos que querem <span className="font-bold text-accent">crescer com clareza</span>.
          </h2>
          <p className="mt-6 text-muted-foreground">
            Se você se reconhece em algum destes pontos, o Psi Real foi pensado para a sua realidade.
          </p>
        </div>

        <ul className="space-y-3">
          {audience.map((a) => (
            <li
              key={a}
              className="flex items-start gap-4 rounded-2xl bg-card border border-border p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <p className="text-foreground leading-relaxed">{a}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
