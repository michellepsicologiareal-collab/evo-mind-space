export type SubscriptionStatus =
  | "free"
  | "pending"
  | "active"
  | "overdue"
  | "cancelled"
  | "expired";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "free",
  "active",
  "pending",
  "overdue",
  "cancelled",
  "expired",
];

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  free: "Gratuito",
  active: "Ativo",
  pending: "Pagamento pendente",
  overdue: "Atrasado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  free: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  overdue: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

export const STATUS_DOTS: Record<SubscriptionStatus, string> = {
  free: "bg-muted-foreground/50",
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  overdue: "bg-orange-500",
  cancelled: "bg-muted-foreground/50",
  expired: "bg-red-500",
};

/** Plano gratuito padrão exibido quando o usuário ainda não assinou. */
export const FREE_PLAN_NAME = "Grátis";
/** Nome do plano pago padrão sugerido no painel administrativo. */
export const PAID_PLAN_NAME = "PsiReal Mensal";

/** Fallback usado enquanto o link configurável não carrega. */
export const DEFAULT_KIWIFY_URL = "https://pay.kiwify.com.br/k4VMHLa";

export const isProblemStatus = (s: SubscriptionStatus) =>
  s === "pending" || s === "overdue" || s === "expired";

export const formatPlanDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};
