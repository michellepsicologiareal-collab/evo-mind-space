import { Users, BookOpen, BarChart3, ShieldCheck, MessageSquare, ClipboardCheck } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestão de Supervisionandos",
    desc: "Cadastre seus supervisionandos, acompanhe a evolução de cada um e mantenha tudo organizado em um painel dedicado.",
  },
  {
    icon: ClipboardCheck,
    title: "Registro de Casos Clínicos",
    desc: "Documente discussões de caso, formulações clínicas e planos de intervenção — tudo alinhado às diretrizes do CRP.",
  },
  {
    icon: MessageSquare,
    title: "Devolutivas Estruturadas",
    desc: "Registre feedbacks, orientações e pontos de atenção de cada encontro de supervisão com organização cronológica.",
  },
  {
    icon: BarChart3,
    title: "Painel de Supervisão Integrado",
    desc: "Visão geral dos seus supervisionandos: casos ativos, próximos encontros e evolução clínica em um só lugar.",
  },
  {
    icon: BookOpen,
    title: "Biblioteca de Materiais",
    desc: "Compartilhe artigos, protocolos e referências com seus supervisionandos diretamente pela plataforma.",
  },
  {
    icon: ShieldCheck,
    title: "Alinhado ao CRP",
    desc: "Fluxos de trabalho desenhados considerando as resoluções e o código de ética do Conselho Regional de Psicologia.",
  },
];

export const Supervision = () => {
  return (
    <section id="supervisao" className="py-16 sm:py-20 lg:py-32 bg-gradient-soft">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
            Supervisão Clínica
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground text-balance">
            Supervisione de verdade.
            <br />
            <span className="font-bold text-accent">Com pessoas, com estrutura.</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
            Se você é supervisora clínica, o Psi Real oferece um módulo completo para
            acompanhar seus supervisionandos, registrar discussões de caso e manter
            tudo dentro das normas do CRP.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
