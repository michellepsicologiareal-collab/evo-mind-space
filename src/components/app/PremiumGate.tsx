import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";

const PAYMENT_LINK = "https://pay.kiwify.com.br/SEU_LINK_AQUI";

interface PremiumGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumGate = ({ open, onOpenChange }: PremiumGateProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-2">
            <Lock className="h-8 w-8 text-accent" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Recurso Exclusivo do Essencial PsiReal
          </DialogTitle>
          <DialogDescription className="text-base">
            Desbloqueie todos os recursos do Psi Real para organizar sua clínica de forma completa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl bg-muted/50 p-4 text-sm text-left space-y-2">
            <p className="font-semibold flex items-center gap-2"><Crown className="h-4 w-4 text-accent" /> Com o Essencial PsiReal você tem:</p>
            <ul className="space-y-1 text-muted-foreground ml-6 list-disc">
              <li>Pacientes ilimitados</li>
              <li>Financeiro avançado com relatórios</li>
              <li>Supervisão e supervisionandos</li>
              <li>Registros TCC e evolução</li>
              <li>Suporte prioritário</li>
            </ul>
          </div>

          <p className="text-2xl font-extrabold">
            R$ 39,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
          </p>

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => window.open(PAYMENT_LINK, "_blank")}
          >
            <Crown className="h-4 w-4" /> Assinar Agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
