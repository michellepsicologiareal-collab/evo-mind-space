// Regras compartilhadas de status de cobrança (Financeiro e Agenda).

export type BillingStatus = "pago" | "vencida" | "perto" | "enviada" | "a_enviar" | "na";

export const DUE_SOON_DAYS = 3;

export const BILLING_LABEL: Record<BillingStatus, string> = {
  pago: "Pago",
  vencida: "Vencida",
  perto: "Perto do vencimento",
  enviada: "Cobrança enviada",
  a_enviar: "Cobrança a enviar",
  na: "—",
};

export const BILLING_TONE: Record<BillingStatus, string> = {
  pago: "bg-moss/10 text-moss border-moss/20",
  vencida: "bg-destructive/10 text-destructive border-destructive/25",
  perto: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400",
  enviada: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400",
  a_enviar: "bg-secondary text-foreground/70 border-border",
  na: "bg-secondary text-muted-foreground border-border",
};

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysUntil = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - startOfToday().getTime()) / 86400000);
};

export const formatDue = (dateStr: string | null) =>
  dateStr ? dateStr.split("-").reverse().join("/") : null;

export type BillingInput = {
  status?: string | null;
  payment_status?: string | null;
  billing_sent_at?: string | null;
  payment_due_date?: string | null;
};

/** Modalidade de cobrança: por sessão realizada ou por plano/pacote fechado. */
export type BillingMode = "per_session" | "plan";

/** Deriva o status da cobrança de um conjunto de sessões faturáveis.
 *  - per_session: só sessões realizadas (ou já pagas) entram na cobrança.
 *  - plan: o pacote inteiro é cobrável, mesmo com sessões futuras. */
export const computeBillingStatus = (
  list: BillingInput[],
  soonDays: number = DUE_SOON_DAYS,
  mode: BillingMode = "per_session"
): { status: BillingStatus; dueDate: string | null; sentAt: string | null } => {
  const billable =
    mode === "plan"
      ? list.filter((r) => r.status !== "cancelled")
      : list.filter((r) => r.status === "completed" || r.payment_status === "paid");
  if (billable.length === 0) return { status: "na", dueDate: null, sentAt: null };

  const pending = billable.filter((r) => r.payment_status === "pending");
  const sentAt =
    billable
      .map((r) => r.billing_sent_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
  const dueDate =
    (pending.length ? pending : billable)
      .map((r) => r.payment_due_date)
      .filter(Boolean)
      .sort()[0] ?? null;

  if (pending.length === 0) return { status: "pago", dueDate, sentAt };
  const dias = daysUntil(dueDate);
  if (dias !== null && dias < 0) return { status: "vencida", dueDate, sentAt };
  if (dias !== null && dias <= soonDays) return { status: "perto", dueDate, sentAt };
  if (sentAt) return { status: "enviada", dueDate, sentAt };
  return { status: "a_enviar", dueDate, sentAt };
};

// ── Fonte única da regra de "em aberto" (cabeçalho, totais e lista) ──────
/** Modalidade FINANCEIRA de plano/pacote: série com pagamento único ("Pgto único").
 *  Uma série clínica marcada como "Pgto por sessão" é cobrança avulsa. */
export const isPlanNotes = (notes?: string | null): boolean =>
  !!notes && /Plano \d+ sess/.test(notes) && !/Pgto por sess/i.test(notes);

export type ChargeRow = {
  status?: string | null;
  payment_status?: string | null;
  notes?: string | null;
};

/** Cobrança EM ABERTO (pendente):
 *  - Plano/pacote: a cobrança do plano fica em aberto mesmo com sessões futuras.
 *  - Sessão avulsa: só depois de realizada. */
export const isPendingCharge = (r: ChargeRow): boolean =>
  r.payment_status === "pending" &&
  r.status !== "cancelled" &&
  (isPlanNotes(r.notes) || r.status === "completed");

/** PREVISTO: sessão avulsa futura (agendada/confirmada) ainda não paga. */
export const isForecastCharge = (r: ChargeRow): boolean =>
  r.payment_status === "pending" &&
  !isPlanNotes(r.notes) &&
  (r.status === "scheduled" || r.status === "confirmed");
