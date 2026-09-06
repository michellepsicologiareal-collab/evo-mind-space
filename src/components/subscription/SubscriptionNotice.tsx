import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionNoticeProps {
  className?: string;
}

export const SubscriptionNotice = ({ className }: SubscriptionNoticeProps) => (
  <aside
    className={cn(
      "rounded-xl border border-orange-300 bg-orange-50 p-3 text-left text-xs leading-relaxed text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
      className,
    )}
    aria-label="Atenção sobre a assinatura"
  >
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
      <p>
        <strong className="block text-sm">Atenção, Psi:</strong>
        Assinatura semestral — R$ 58,90. Renovação a cada 6 meses. No cartão Visa/Mastercard,
        a cobrança é automática. No PIX, uma nova cobrança é enviada a cada semestre. Para
        cancelar, entre em contato antes da próxima renovação.
      </p>
    </div>
  </aside>
);