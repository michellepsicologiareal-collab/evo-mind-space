import { useState } from "react";
import {
  CheckCircle2, Circle, Users, Calendar, Wallet, FileText, Settings,
  BookOpen, Flower2, GraduationCap, MessageCircle, ArrowRight, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Step {
  id: string;
  title: string;
  description: string;
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
  route?: string;
  routeLabel?: string;
}

const steps: Step[] = [
  {
    id: "perfil",
    title: "1. Complete seu Perfil",
    description: "Configure suas informações profissionais para personalizar o sistema.",
    details: [
      "Acesse Perfil no menu lateral",
      "Preencha seu nome completo, CRP e telefone",
      "Adicione sua chave Pix para cobranças automatizadas",
      "Defina o valor padrão das sessões",
    ],
    icon: Settings,
    route: "/app/perfil",
    routeLabel: "Ir para Perfil",
  },
  {
    id: "pacientes",
    title: "2. Cadastre seus Pacientes",
    description: "Adicione seus pacientes com as informações essenciais.",
    details: [
      "Clique em '+ Novo Paciente' na tela de Pacientes",
      "Informe nome, telefone e valor da sessão",
      "Se houver responsável financeiro, ative a opção",
      "Pacientes inativos podem ser arquivados sem perder dados",
    ],
    icon: Users,
    route: "/app/pacientes",
    routeLabel: "Ir para Pacientes",
  },
  {
    id: "agenda",
    title: "3. Organize sua Agenda",
    description: "Agende sessões individuais ou recorrentes com facilidade.",
    details: [
      "Clique em '+ Nova Sessão' ou no botão '+' ao lado do dia",
      "Selecione o paciente, data, horário e valor",
      "Para sessões recorrentes, escolha 'Recorrente' e defina a frequência",
      "Use 'Pagamento único' para cobrar o pacote todo de uma vez",
      "Envie confirmação de sessão pelo link de confirmação",
    ],
    icon: Calendar,
    route: "/app/agenda",
    routeLabel: "Ir para Agenda",
  },
  {
    id: "cobranca",
    title: "4. Envie Cobranças pelo WhatsApp",
    description: "Cobre seus pacientes de forma profissional e prática.",
    details: [
      "No painel 'Sessões do Mês' da Agenda, encontre a sessão pendente",
      "Clique no ícone do WhatsApp (💬) ao lado da sessão",
      "A mensagem de cobrança é gerada automaticamente com valor e chave Pix",
      "Após o pagamento, mude o status para 'Pago' no dropdown",
      "A data de envio da cobrança fica registrada no card da sessão",
    ],
    icon: MessageCircle,
  },
  {
    id: "financeiro",
    title: "5. Acompanhe o Financeiro",
    description: "Visualize receitas, despesas e o resumo mensal.",
    details: [
      "O Financeiro consolida todas as sessões do mês",
      "Veja totais de receita, despesa e saldo líquido",
      "Filtre por período para análises específicas",
      "Supervisões são contabilizadas como despesa automaticamente",
    ],
    icon: Wallet,
    route: "/app/financeiro",
    routeLabel: "Ir para Financeiro",
  },
  {
    id: "termo",
    title: "6. Crie seu Termo / Contrato",
    description: "Configure modelos de termo de consentimento para seus pacientes.",
    details: [
      "Acesse 'Termo' no menu para criar seu modelo padrão",
      "Personalize com suas informações e cláusulas",
      "Em 'Contratos', gere um contrato individual para cada paciente",
      "O paciente recebe um link público para visualizar o contrato",
    ],
    icon: FileText,
    route: "/app/contrato-modelo",
    routeLabel: "Ir para Termo",
  },
  {
    id: "biblioteca",
    title: "7. Use a Biblioteca",
    description: "Salve materiais de referência, protocolos e escalas.",
    details: [
      "Adicione anotações por categorias (escalas, protocolos, referências)",
      "Organize conteúdos que você usa com frequência na clínica",
      "Acesse rapidamente durante as sessões",
    ],
    icon: BookOpen,
    route: "/app/biblioteca",
    routeLabel: "Ir para Biblioteca",
  },
  {
    id: "autocuidado",
    title: "8. Cuide de Você — Autocuidado",
    description: "O sistema também pensa em você, terapeuta. 💚",
    details: [
      "Registre como está se sentindo ao longo da semana",
      "Acompanhe seu humor e energia ao longo do tempo",
      "Lembretes gentis para pausas e autocuidado",
      "Porque quem cuida, também precisa ser cuidado",
    ],
    icon: Flower2,
    route: "/app/autocuidado",
    routeLabel: "Ir para Autocuidado",
  },
];

const ComecePorAqui = () => {
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("psireal-onboarding-completed");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [expandedStep, setExpandedStep] = useState<string | null>(steps[0].id);

  const toggleComplete = (id: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("psireal-onboarding-completed", JSON.stringify([...next]));
      return next;
    });
  };

  const progress = Math.round((completedSteps.size / steps.length) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-foreground">Comece por Aqui</h1>
        </div>
        <p className="text-muted-foreground">
          Siga o passo a passo para configurar e aproveitar ao máximo o Psi Real.
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Seu progresso</p>
          <span className="text-sm font-bold text-accent">{completedSteps.size}/{steps.length} etapas</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="mt-3 text-sm text-emerald-600 font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Parabéns! Você completou todas as etapas! 🎉
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          const isExpanded = expandedStep === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-2xl border bg-card shadow-soft transition-all duration-200",
                isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-border",
              )}
            >
              {/* Step header */}
              <button
                type="button"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                className="w-full flex items-center gap-4 p-5 text-left"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleComplete(step.id); }}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border text-muted-foreground hover:border-accent hover:text-accent",
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-accent/10 text-accent",
                )}>
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-display text-sm font-semibold",
                    isCompleted ? "text-emerald-700 line-through" : "text-foreground",
                  )}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
                <ArrowRight className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90",
                )} />
              </button>

              {/* Step details (expanded) */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0 ml-[4.5rem]">
                  <ul className="space-y-2 mb-4">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
                          {i + 1}
                        </span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                  {step.route && (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => navigate(step.route!)}
                      className="rounded-xl"
                    >
                      {step.routeLabel} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Support footer */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-soft text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Ficou com alguma dúvida? Fale com o suporte! 💬
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => window.open("https://wa.me/5511947388423?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Psi%20Real", "_blank")}
        >
          <MessageCircle className="h-4 w-4 mr-1.5" /> Falar pelo WhatsApp
        </Button>
      </div>
    </div>
  );
};

export default ComecePorAqui;
