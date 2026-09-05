import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, BellRing, FileSearch } from "lucide-react";

export interface AuditSessionRow {
  id: string;
  scheduled_at: string;
  price: number | null;
  paid_at: string | null;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  billing_sent_at: string | null;
  payment_due_date: string | null;
  patient: { id: string; full_name: string } | null;
}

export interface AuditReminderLog {
  id: string;
  plan_key: string;
  plan_label: string | null;
  status: string;
  due_date: string | null;
  days_ahead: number | null;
  pending_value: number | string | null;
  channel: string;
  notified_at: string;
}

type EventKind = "pagamento" | "cobranca" | "lembrete";

interface AuditEvent {
  id: string;
  kind: EventKind;
  at: string;
  patient: string;
  title: string;
  origin: string;
  detail?: string;
}

const KIND_META: Record<EventKind, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  pagamento: {
    label: "Pagamento",
    icon: CheckCircle2,
    tone: "bg-moss/10 text-moss border-moss/25",
  },
  cobranca: {
    label: "Cobrança",
    icon: MessageCircle,
    tone: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/25",
  },
  lembrete: {
    label: "Lembrete",
    icon: BellRing,
    tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25",
  },
};

const METHOD_LABEL: Record<string, string> = { pix: "PIX", card: "Cartão", cash: "Dinheiro" };

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  auto: "Lembrete automático do sistema",
  manual: "Registro manual",
};

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const dt = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: AuditSessionRow[];
  reminderLogs: AuditReminderLog[];
  periodLabel?: string;
}

/**
 * Auditoria financeira: mostra a origem de cada selo exibido no Financeiro
 * (pagamento recebido, cobrança enviada e lembretes), com data e evento.
 */
export const BillingAuditSheet = ({ open, onOpenChange, sessions, reminderLogs, periodLabel }: Props) => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | EventKind>("all");

  const events = useMemo<AuditEvent[]>(() => {
    const list: AuditEvent[] = [];

    for (const s of sessions) {
      const name = s.patient?.full_name ?? "Paciente";
      const sessionDate = format(new Date(s.scheduled_at), "dd/MM/yyyy", { locale: ptBR });
      const value = s.price != null ? formatBRL(Number(s.price)) : "valor não informado";

      if (s.paid_at) {
        list.push({
          id: `pay-${s.id}`,
          kind: "pagamento",
          at: s.paid_at,
          patient: name,
          title: `Pagamento registrado · ${value}`,
          origin: `Baixa registrada no app${s.payment_method ? ` · ${METHOD_LABEL[s.payment_method] ?? s.payment_method}` : ""}`,
          detail: `Sessão de ${sessionDate}${s.payment_reference ? ` · ref. ${s.payment_reference}` : ""}`,
        });
      }

      if (s.billing_sent_at) {
        list.push({
          id: `bill-${s.id}`,
          kind: "cobranca",
          at: s.billing_sent_at,
          patient: name,
          title: `Cobrança enviada · ${value}`,
          origin: "Envio pelo WhatsApp a partir do Financeiro",
          detail: `Sessão de ${sessionDate}${
            s.payment_due_date
              ? ` · vencimento ${format(new Date(`${s.payment_due_date}T12:00:00`), "dd/MM/yyyy")}`
              : ""
          }`,
        });
      }
    }

    for (const l of reminderLogs) {
      const pending = l.pending_value == null ? null : Number(l.pending_value);
      list.push({
        id: `log-${l.id}`,
        kind: "lembrete",
        at: l.notified_at,
        patient: l.plan_label ?? "Cobrança",
        title: `Lembrete de cobrança${pending != null && Number.isFinite(pending) ? ` · ${formatBRL(pending)}` : ""}`,
        origin: CHANNEL_LABEL[l.channel] ?? l.channel,
        detail: [
          l.due_date ? `vencimento ${format(new Date(`${l.due_date}T12:00:00`), "dd/MM/yyyy")}` : null,
          l.days_ahead != null ? `${l.days_ahead} dia(s) de antecedência` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [sessions, reminderLogs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) => (kind === "all" || e.kind === kind) && (!q || e.patient.toLowerCase().includes(q))
    );
  }, [events, kind, query]);

  const chips: Array<{ key: "all" | EventKind; label: string }> = [
    { key: "all", label: `Todos (${events.length})` },
    { key: "pagamento", label: `Pagamentos (${events.filter((e) => e.kind === "pagamento").length})` },
    { key: "cobranca", label: `Cobranças (${events.filter((e) => e.kind === "cobranca").length})` },
    { key: "lembrete", label: `Lembretes (${events.filter((e) => e.kind === "lembrete").length})` },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
            Auditoria de pagamentos e cobranças
          </SheetTitle>
          <SheetDescription>
            Todos os eventos que geram os selos do Financeiro{periodLabel ? ` — ${periodLabel}` : ""}: pagamento
            recebido, cobrança enviada e lembretes, com data e origem.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por paciente…"
            aria-label="Buscar por paciente na auditoria"
          />
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Button
                key={c.key}
                type="button"
                size="sm"
                variant={kind === c.key ? "secondary" : "outline"}
                className="h-8 text-xs"
                aria-pressed={kind === c.key}
                onClick={() => setKind(c.key)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum evento registrado neste filtro.
          </p>
        ) : (
          <ol className="mt-4 space-y-2.5 pb-8">
            {filtered.map((e) => {
              const meta = KIND_META[e.kind];
              const Icon = meta.icon;
              return (
                <li key={e.id} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.tone}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium text-sm text-foreground truncate">{e.patient}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground/85">{e.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {dt(e.at)} · {e.origin}
                      </p>
                      {e.detail && <p className="text-[11px] text-muted-foreground">{e.detail}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BillingAuditSheet;
