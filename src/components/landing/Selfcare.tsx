import { Heart, Shield, Moon, Sparkles } from "lucide-react";

import mockupEmocoes from "@/assets/mockup-emocoes-v2.png";
import mockupPacientes from "@/assets/mockup-pacientes.png";

const pillars = [
  { icon: Moon, label: "Check-in diário", desc: "Protocolo PLEASE: sono, alimentação, movimento, saúde e equilíbrio." },
  { icon: Heart, label: "Regulação emocional", desc: "Ferramentas de TIP, mindfulness, box breathing e aceitação radical." },
  { icon: Shield, label: "Monitoramento de estresse", desc: "Escala visual + histórico mensal para identificar padrões." },
  { icon: Sparkles, label: "Clima emocional", desc: "Variação de humor, gatilhos e pacientes que mais ativam." },
];

export const Selfcare = () => {
  return (
    <section id="autocuidado" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" aria-hidden />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl" aria-hidden />

      <div className="container relative">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-4 py-1.5 mb-6">
            <Heart className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Exclusivo</span>
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-medium leading-tight">
            Autocuidado do
            <span className="block font-bold text-accent mt-1">Terapeuta</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
            Você cuida dos outros o dia inteiro. O Psi Real cuida de você. Um espaço dedicado para monitorar
            seu bem-estar emocional, identificar padrões e prevenir o esgotamento profissional.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pillars.map((p) => (
            <div
              key={p.label}
              className="group relative rounded-2xl border border-border/70 bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{p.label}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Mockups showcase */}
        <div className="mt-16 grid lg:grid-cols-2 gap-6 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-accent/8 via-primary/5 to-transparent rounded-[2rem] blur-xl" aria-hidden />
            <img
              src={mockupEmocoes}
              alt="Painel de clima emocional com variação de humor e gatilhos"
              className="relative w-full rounded-2xl border border-border/70 shadow-elegant"
              loading="lazy"
            />
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-bl from-accent/8 via-primary/5 to-transparent rounded-[2rem] blur-xl" aria-hidden />
            <img
              src={mockupPacientes}
              alt="Gestão de pacientes com cards organizados"
              className="relative w-full rounded-2xl border border-border/70 shadow-elegant"
              loading="lazy"
            />
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum outro sistema clínico oferece isso.{" "}
            <a href="/auth?tab=signup" className="text-accent font-semibold hover:underline underline-offset-4">
              Experimente grátis →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
