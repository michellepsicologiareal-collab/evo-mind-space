import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { DEFAULT_KIWIFY_URL } from "@/lib/subscription";

interface PlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const semestralPlan = {
  name: "PsiReal Semestral",
  price: "R$ 58,90",
  period: "/6 meses",
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
  href: DEFAULT_KIWIFY_URL,
};

export const PlanModal = ({ open, onOpenChange }: PlanModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> PsiReal Semestral
          </DialogTitle>
          <DialogDescription>
            6 meses de acesso completo por R$ 58,90 — menos de R$ 10 por mês.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-2">
          <div className="rounded-2xl border-2 border-accent bg-card p-5 flex flex-col relative ring-1 ring-accent/20">
            <span className="absolute -top-3 left-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Menos de R$ 10/mês
            </span>
            <h3 className="text-lg font-bold">{semestralPlan.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{semestralPlan.description}</p>
            <p className="text-3xl font-extrabold mb-1">
              {semestralPlan.price}
              <span className="text-sm font-normal text-muted-foreground">{semestralPlan.period}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">Renovação a cada 6 meses</p>
            <ul className="space-y-2 flex-1">
              {semestralPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="accent"
              className="mt-5 w-full"
              onClick={() => window.open(semestralPlan.href, "_blank")}
            >
              Assinar 6 meses por R$ 58,90
            </Button>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Cobrança única de R$ 58,90 a cada 6 meses, renovada automaticamente pelo mesmo valor
              salvo cancelamento. Cancele quando quiser e mantenha o acesso até o fim do período
              pago. Pagamento seguro via Kiwify.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
