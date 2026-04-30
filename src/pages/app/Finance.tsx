import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type PaymentStatus = "pending" | "paid";

interface Row {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: PaymentStatus;
  price: number | null;
  paid_at: string | null;
  patient: { full_name: string } | null;
}

const formatBRL = (n: number) =>
  `R$ ${n.toFixed(2).replace(".", ",")}`;

const Finance = () => {
  const { user } = useAuth();
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, scheduled_at, status, payment_status, price, paid_at, patient:patients(full_name)")
      .gte("scheduled_at", monthStart.toISOString())
      .lte("scheduled_at", monthEnd.toISOString())
      .order("scheduled_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar dados financeiros.");
      setLoading(false);
      return;
    }
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthCursor]);

  const billable = rows.filter((r) => r.status === "completed");
  const totalFaturado = billable.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const totalRecebido = billable
    .filter((r) => r.payment_status === "paid")
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const totalPendente = totalFaturado - totalRecebido;
  const sessoesPagas = billable.filter((r) => r.payment_status === "paid").length;
  const sessoesPendentes = billable.filter((r) => r.payment_status === "pending").length;

  const updatePayment = async (id: string, value: PaymentStatus) => {
    const { error } = await supabase
      .from("sessions")
      .update({
        payment_status: value,
        paid_at: value === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    toast.success(value === "paid" ? "Sessão marcada como paga." : "Sessão marcada como pendente.");
    load();
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Financeiro</p>
          <h1 className="mt-1 font-display text-4xl font-medium">Faturamento</h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe sessões pagas, pendentes e seu faturamento mensal.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-full p-1">
          <Button variant="ghost" size="icon" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3 capitalize min-w-[140px] text-center">
            {format(monthCursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Faturado no mês" value={formatBRL(totalFaturado)} accent />
        <KpiCard icon={Wallet} label="Recebido" value={formatBRL(totalRecebido)} hint={`${sessoesPagas} sessões`} />
        <KpiCard icon={Clock} label="A receber" value={formatBRL(totalPendente)} hint={`${sessoesPendentes} sessões`} />
        <KpiCard icon={CheckCircle2} label="Sessões realizadas" value={billable.length.toString()} />
      </section>

      <section className="rounded-3xl bg-card border border-border p-6 lg:p-8">
        <Tabs defaultValue="all">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-semibold">Sessões do mês</h2>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="paid">Pagas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            <SessionsTable rows={billable} loading={loading} onChange={updatePayment} />
          </TabsContent>
          <TabsContent value="pending">
            <SessionsTable rows={billable.filter((r) => r.payment_status === "pending")} loading={loading} onChange={updatePayment} />
          </TabsContent>
          <TabsContent value="paid">
            <SessionsTable rows={billable.filter((r) => r.payment_status === "paid")} loading={loading} onChange={updatePayment} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

const SessionsTable = ({
  rows,
  loading,
  onChange,
}: {
  rows: Row[];
  loading: boolean;
  onChange: (id: string, v: PaymentStatus) => void;
}) => {
  if (loading) {
    return <p className="text-center py-12 text-muted-foreground">Carregando…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhuma sessão neste período.</p>
        <p className="text-xs mt-2">Apenas sessões marcadas como realizadas entram no financeiro.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((s) => (
        <li key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{s.patient?.full_name ?? "—"}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {format(new Date(s.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              {s.payment_status === "paid" && s.paid_at && (
                <span className="ml-2 text-xs">· pago em {format(new Date(s.paid_at), "dd/MM")}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-display text-lg font-semibold">{formatBRL(Number(s.price ?? 0))}</span>
            <Select value={s.payment_status} onValueChange={(v) => onChange(s.id, v as PaymentStatus)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </li>
      ))}
    </ul>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) => (
  <div
    className={`rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft ${
      accent ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border"
    }`}
  >
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
        accent ? "bg-primary-foreground/15" : "bg-secondary text-primary"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
    <p className={`mt-4 text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
      {label}
    </p>
    <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    {hint && (
      <p className={`mt-1 text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</p>
    )}
  </div>
);

export default Finance;
