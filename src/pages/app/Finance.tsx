import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Smartphone,
  CreditCard,
  Banknote,
  AlertTriangle,
  BellRing,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
  formatDistanceToNow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type PaymentStatus = "pending" | "paid";
type PaymentMethod = "pix" | "card" | "cash";

interface Row {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  price: number | null;
  paid_at: string | null;
  patient: { full_name: string } | null;
}

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

const MethodIcon = ({ method, className }: { method: PaymentMethod; className?: string }) => {
  if (method === "pix") return <Smartphone className={className} />;
  if (method === "card") return <CreditCard className={className} />;
  return <Banknote className={className} />;
};

const Finance = () => {
  const { user } = useAuth();
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderWindow, setReminderWindow] = useState(24);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const recentAlertRef = useRef<HTMLDivElement | null>(null);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, scheduled_at, status, payment_status, payment_method, payment_reference, price, paid_at, patient:patients(full_name)")
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

  // Load reminder preferences from profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("reminder_enabled, reminder_window_hours")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderWindow(data.reminder_window_hours ?? 24);
      }
      setPrefsLoaded(true);
    })();
  }, [user]);

  const savePrefs = async (next: { enabled?: boolean; window?: number }) => {
    if (!user) return;
    const enabled = next.enabled ?? reminderEnabled;
    const windowH = next.window ?? reminderWindow;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({ reminder_enabled: enabled, reminder_window_hours: windowH })
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) {
      toast.error("Não foi possível salvar a preferência.");
      return;
    }
    // Reset notified set so toggling/changing window can re-notify
    notifiedIdsRef.current.clear();
  };

  const billable = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);
  const totalFaturado = billable.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const totalRecebido = billable
    .filter((r) => r.payment_status === "paid")
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const totalPendente = totalFaturado - totalRecebido;
  const sessoesPagas = billable.filter((r) => r.payment_status === "paid").length;
  const sessoesPendentes = billable.filter((r) => r.payment_status === "pending").length;

  const missingReference = useMemo(
    () =>
      billable.filter(
        (r) =>
          r.payment_status === "paid" &&
          (r.payment_method === "pix" || r.payment_method === "card") &&
          (!r.payment_reference || r.payment_reference.trim().length === 0)
      ),
    [billable]
  );

  const recentMissing = useMemo(() => {
    if (!reminderEnabled) return [];
    const cutoff = Date.now() - reminderWindow * 60 * 60 * 1000;
    return missingReference.filter((r) => {
      const ref = r.paid_at ?? r.scheduled_at;
      return ref ? new Date(ref).getTime() >= cutoff : false;
    });
  }, [missingReference, reminderEnabled, reminderWindow]);

  const olderMissing = useMemo(() => {
    const recentIds = new Set(recentMissing.map((r) => r.id));
    return missingReference.filter((r) => !recentIds.has(r.id));
  }, [missingReference, recentMissing]);

  // Auto-reminder toast for paid PIX/card sessions in the configured window missing reference
  useEffect(() => {
    if (loading || !prefsLoaded || !reminderEnabled) return;
    const newOnes = recentMissing.filter((r) => !notifiedIdsRef.current.has(r.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((r) => notifiedIdsRef.current.add(r.id));

    const names = newOnes
      .slice(0, 2)
      .map((r) => r.patient?.full_name ?? "Paciente")
      .join(", ");
    const extra = newOnes.length > 2 ? ` e mais ${newOnes.length - 2}` : "";
    const windowLabel =
      reminderWindow === 24
        ? "24h"
        : reminderWindow < 24
        ? `${reminderWindow}h`
        : `${Math.round(reminderWindow / 24)}d`;

    toast.warning(
      newOnes.length === 1
        ? "Pagamento recente sem referência"
        : `${newOnes.length} pagamentos recentes sem referência`,
      {
        description: `${names}${extra} · marcado(s) como pago(s) nas últimas ${windowLabel} via PIX/cartão.`,
        duration: 8000,
        action: {
          label: "Revisar",
          onClick: () =>
            recentAlertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        },
      }
    );
  }, [recentMissing, loading, prefsLoaded, reminderEnabled, reminderWindow]);


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

      {recentMissing.length > 0 && (
        <Alert
          ref={recentAlertRef}
          variant="destructive"
          className="border-destructive bg-destructive/10 shadow-soft"
        >
          <BellRing className="h-4 w-4 animate-pulse" />
          <AlertTitle>Lembrete: pagamentos recentes sem referência</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {recentMissing.length === 1
                ? "1 sessão foi marcada como paga via PIX/cartão nas últimas 24h sem referência. Adicione o comprovante enquanto a transação ainda está fresca:"
                : `${recentMissing.length} sessões foram marcadas como pagas via PIX/cartão nas últimas 24h sem referência. Adicione os comprovantes enquanto as transações ainda estão frescas:`}
            </p>
            <ul className="text-sm space-y-1 mt-2">
              {recentMissing.slice(0, 5).map((r) => {
                const when = r.paid_at ?? r.scheduled_at;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      <span className="font-medium">{r.patient?.full_name ?? "—"}</span>
                      {" · "}
                      {r.payment_method === "pix" ? "PIX" : "Cartão"}
                      {" · há "}
                      {formatDistanceToNow(new Date(when), { locale: ptBR })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setEditing(r)}
                    >
                      Adicionar referência
                    </Button>
                  </li>
                );
              })}
              {recentMissing.length > 5 && (
                <li className="text-xs opacity-80">+ {recentMissing.length - 5} outras…</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {olderMissing.length > 0 && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {olderMissing.length === 1
              ? "1 sessão paga sem referência"
              : `${olderMissing.length} sessões pagas sem referência`}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Pagamentos via PIX ou cartão precisam ter a referência preenchida (ex.: comprovante, NSU). Edite cada sessão para regularizar:
            </p>
            <ul className="text-sm space-y-1 mt-2">
              {olderMissing.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-medium">{r.patient?.full_name ?? "—"}</span>
                    {" · "}
                    {format(new Date(r.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    {" · "}
                    {r.payment_method === "pix" ? "PIX" : "Cartão"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditing(r)}
                  >
                    Corrigir
                  </Button>
                </li>
              ))}
              {olderMissing.length > 5 && (
                <li className="text-xs opacity-80">+ {olderMissing.length - 5} outras…</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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
            <SessionsTable rows={billable} loading={loading} onChange={updatePayment} onEdit={setEditing} />
          </TabsContent>
          <TabsContent value="pending">
            <SessionsTable rows={billable.filter((r) => r.payment_status === "pending")} loading={loading} onChange={updatePayment} onEdit={setEditing} />
          </TabsContent>
          <TabsContent value="paid">
            <SessionsTable rows={billable.filter((r) => r.payment_status === "paid")} loading={loading} onChange={updatePayment} onEdit={setEditing} />
          </TabsContent>
        </Tabs>
      </section>


      <PaymentDetailsDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
};

const SessionsTable = ({
  rows,
  loading,
  onChange,
  onEdit,
}: {
  rows: Row[];
  loading: boolean;
  onChange: (id: string, v: PaymentStatus) => void;
  onEdit: (r: Row) => void;
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
        <li key={s.id} className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">{s.patient?.full_name ?? "—"}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {format(new Date(s.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              {s.payment_status === "paid" && s.paid_at && (
                <span className="ml-2 text-xs">· pago em {format(new Date(s.paid_at), "dd/MM")}</span>
              )}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {s.payment_method ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  <MethodIcon method={s.payment_method} className="h-3 w-3" />
                  {METHOD_LABEL[s.payment_method]}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Sem método</span>
              )}
              {s.payment_reference && (
                <span className="text-muted-foreground truncate max-w-[280px]">· {s.payment_reference}</span>
              )}
              {s.payment_status === "paid" &&
                (s.payment_method === "pix" || s.payment_method === "card") &&
                (!s.payment_reference || s.payment_reference.trim().length === 0) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    Sem referência
                  </span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display text-lg font-semibold">{formatBRL(Number(s.price ?? 0))}</span>
            <Select value={s.payment_status} onValueChange={(v) => onChange(s.id, v as PaymentStatus)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => onEdit(s)} title="Editar pagamento">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const PaymentDetailsDialog = ({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [method, setMethod] = useState<PaymentMethod | "none">("none");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setMethod((row.payment_method as PaymentMethod | null) ?? "none");
      setReference(row.payment_reference ?? "");
      setRefError(null);
    }
  }, [row]);

  if (!row) return null;

  const requiresReference = method === "pix" || method === "card";
  const trimmedRef = reference.trim();

  const save = async () => {
    if (requiresReference && trimmedRef.length === 0) {
      setRefError(
        method === "pix"
          ? "Informe a referência do PIX (ex.: comprovante, ID da transação)."
          : "Informe a referência do cartão (ex.: últimos 4 dígitos, NSU)."
      );
      return;
    }
    setRefError(null);
    setSaving(true);
    const ref = trimmedRef.slice(0, 500);
    const { error } = await supabase
      .from("sessions")
      .update({
        payment_method: method === "none" ? null : method,
        payment_reference: ref.length > 0 ? ref : null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Pagamento atualizado.");
    onSaved();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes do pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{row.patient?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {formatBRL(Number(row.price ?? 0))}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Método de pagamento</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod | "none")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">
              Referência / nota
              {requiresReference && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="reference"
              maxLength={500}
              placeholder="Ex.: comprovante #1234, pago via Nubank"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                if (refError) setRefError(null);
              }}
              aria-invalid={!!refError}
              className={refError ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {refError ? (
              <p className="text-xs text-destructive">{refError}</p>
            ) : requiresReference ? (
              <p className="text-xs text-muted-foreground">
                Obrigatório para {method === "pix" ? "PIX" : "cartão"}.
              </p>
            ) : null}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
