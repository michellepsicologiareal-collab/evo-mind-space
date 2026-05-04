import { ShieldCheck, Lock, Scale, Eye, FileCheck, Heart } from "lucide-react";

const badges = [
  {
    icon: ShieldCheck,
    title: "Alinhado ao CRP",
    desc: "Fluxos e registros clínicos desenhados conforme o Código de Ética Profissional e resoluções do Conselho Regional de Psicologia.",
  },
  {
    icon: Lock,
    title: "Dados Criptografados",
    desc: "Criptografia em trânsito (TLS) e em repouso. Cada profissional acessa apenas seus próprios dados — isolamento total.",
  },
  {
    icon: Scale,
    title: "LGPD Compliance",
    desc: "Tratamento de dados pessoais sensíveis de acordo com a Lei Geral de Proteção de Dados. Termos e consentimento integrados.",
  },
  {
    icon: Eye,
    title: "Sigilo Profissional",
    desc: "Nenhum dado clínico é compartilhado, vendido ou acessível por terceiros. Seu prontuário é só seu.",
  },
  {
    icon: FileCheck,
    title: "Prontuários Estruturados",
    desc: "Registro de evolução, formulação de caso e plano terapêutico seguindo as boas práticas da psicologia baseada em evidências.",
  },
  {
    icon: Heart,
    title: "Autocuidado do Profissional",
    desc: "Espaço dedicado ao seu bem-estar: registro de humor, reflexões e lembretes de autocuidado — porque quem cuida também precisa de cuidado.",
  },
];

export const Trust = () => {
  return (
    <section id="confianca" className="py-24 lg:py-32 bg-background">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
            Segurança & Ética
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground text-balance">
            Construído com <span className="font-bold text-accent">responsabilidade</span>.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
            Sabemos que você lida com dados sensíveis. Por isso, cada decisão técnica do Psi Real
            foi tomada pensando em ética, segurança e conformidade.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {badges.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                {b.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
