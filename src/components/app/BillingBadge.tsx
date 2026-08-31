import { BILLING_LABEL, BILLING_TONE, formatDue, type BillingStatus } from "@/lib/billing";

interface BillingBadgeProps {
  status: BillingStatus;
  dueDate?: string | null;
  className?: string;
}

/** Selo padronizado de status de cobrança (Financeiro e Agenda). */
export const BillingBadge = ({ status, dueDate, className = "" }: BillingBadgeProps) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${BILLING_TONE[status]} ${className}`}
  >
    {BILLING_LABEL[status]}
    {dueDate && status !== "pago" && status !== "na" && (
      <span className="opacity-80">· {formatDue(dueDate)}</span>
    )}
  </span>
);

export default BillingBadge;
