import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles } from "lucide-react";

interface PlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const freePlan = {
  name: "Gratuito",
  price: "R$ 0",
  description: "Para quem está começando",
  features: [
    "Até 5 pacientes",
    "Agenda básica",
    "Controle financeiro simples",
    "Painel resumido",
  ],
};

const essentialPlan = {
  name: "Essencial PsiReal",
  price: "R$ 39,90",
  period: "/mês",
  description: "Tudo que você precisa para organizar seu consultório",
  features: [
    "Pacientes ilimitados",
    "Agenda completa com lembretes",
    "Financeiro avançado com relatórios",
    "Registros TCC e evolução",
    "Supervisão e supervisionandos",
    "Catálogo de serviços",
    "Suporte prioritário",
  ],
};

const PAYMENT_LINK = "https://pay.kiwify.com.br/SEU_LINK_AQUI";

export const PlanModal = ({ open, onOpenChange }: PlanModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Escolha seu plano
          </DialogTitle>
          <DialogDescription>
            Comece grátis e evolua quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 p-6 pt-2">
          {/* Free */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
            <h3 className="text-lg font-bold">{freePlan.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{freePlan.description}</p>
            <p className="text-3xl font-extrabold mb-4">{freePlan.price}</p>
            <ul className="space-y-2 flex-1">
              {freePlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-5 w-full" disabled>
              Plano atual
            </Button>
          </div>

          {/* Essencial */}
          <div className="rounded-2xl border-2 border-accent bg-card p-5 flex flex-col relative ring-1 ring-accent/20">
            <span className="absolute -top-3 left-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
              <Crown className="h-3 w-3 text-gold" /> Popular
            </span>
            <h3 className="text-lg font-bold">{essentialPlan.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{essentialPlan.description}</p>
            <p className="text-3xl font-extrabold mb-4">
              {essentialPlan.price}
              <span className="text-sm font-normal text-muted-foreground">{essentialPlan.period}</span>
            </p>
            <ul className="space-y-2 flex-1">
              {essentialPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="accent"
              className="mt-5 w-full"
              onClick={() => window.open(PAYMENT_LINK, "_blank")}
            >
              Assinar Agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
