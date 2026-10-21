import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock, FileText, History, MessageCircle, Receipt, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/app/Skeletons";
import { BillingBadge } from "@/components/app/BillingBadge";
import PatientWhatsAppLog from "@/components/app/PatientWhatsAppLog";
import { computeBillingStatus, isPlanNotes, planGroupIdOf } from "@/lib/billing";
import { patientFinanceColumns, summarizePatientFinance, type PatientFinanceSession } from "@/lib/patientFinance";
import { paymentChangeLabel } from "@/lib/paymentAudit";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const statusLabels: Record<string, string> = { completed: "Realizada", scheduled: "Agendada", confirmed: "Confirmada", cancelled: "Cancelada", no_show: "Falta", rescheduled: "Remarcada" };
interface Change { id: string; action: string; created_at: string; actor_name: string | null; label: string | null; }
interface Props {
  patient: { id: string; name: string } | null;
  month: Date;
  onClose: () => void;
  onManage: (session: PatientFinanceSession, sessions: PatientFinanceSession[]) => void;
  onChart: (id: string) => void;
}

export function PatientFinancePanel({ patient, month, onClose, onManage, onChart }: Props) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PatientFinanceSession[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("sessions");
  const [filter, setFilter] = useState("all");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!patient || !user) return;
    let active = true;
    setLoading(true);
    setError(false);
    setPeriod("month"); setTab("sessions"); setFilter("all");
    (async () => {
      const [rows, logs] = await Promise.all([
        supabase.from("sessions").select(patientFinanceColumns).eq("user_id", user.id).eq("patient_id", patient.id).order("scheduled_at", { ascending: false }),
        supabase.from("payment_change_logs").select("id, action, created_at, actor_name, label").eq("user_id", user.id).eq("patient_id", patient.id).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setSessions((rows.data ?? []) as unknown as PatientFinanceSession[]);
      setChanges(logs.data ?? []);
      setError(Boolean(rows.error || logs.error));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [patient?.id, user?.id, retry]);

  const inPeriod = (date: string) => period === "all" || format(new Date(date), "yyyy-MM") === format(month, "yyyy-MM");
  const periodRows = sessions.filter((s) => inPeriod(s.scheduled_at) && !s.is_expense);
  const totals = summarizePatientFinance(periodRows);
  const paidRows = periodRows.filter((s) => s.status !== "cancelled" && s.payment_status === "paid");
  const pendingRows = periodRows.filter((s) => s.status !== "cancelled" && s.payment_status === "pending");
  const shown = periodRows.filter((s) => filter === "all" || (s.status !== "cancelled" && s.payment_status === filter));
  const manage = (session: PatientFinanceSession) => {
    const planId = isPlanNotes(session.notes) ? planGroupIdOf(session.notes) : null;
    const group = planId ? sessions.filter((s) => s.patient?.id === session.patient?.id && isPlanNotes(s.notes) && planGroupIdOf(s.notes) === planId && !s.is_expense) : [session];
    onManage(session, group);
  };
  const history = changes.filter((c) => period === "all" || format(new Date(c.created_at), "yyyy-MM") === format(month, "yyyy-MM"));

  return <Sheet open={Boolean(patient)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-4xl">
      <SheetHeader className="shrink-0 border-b border-border bg-card px-5 pb-5 pt-7 text-left sm:px-8">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><Wallet className="h-4 w-4" /> Painel financeiro do paciente</div>
        <SheetTitle className="pr-8 font-sans text-2xl font-semibold break-words">{patient?.name}</SheetTitle>
        <SheetDescription>{period === "all" ? "Todo o histórico" : format(month, "MMMM 'de' yyyy", { locale: ptBR })}</SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger aria-label="Período do painel do paciente" className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="month">Mês selecionado</SelectItem><SelectItem value="all">Todo o histórico</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { if (patient) onChart(patient.id); }}><ArrowUpRight /> Ficha do paciente</Button>
        </div>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {loading ? <ListSkeleton count={5} /> : error ? <div role="alert" className="space-y-3 py-8 text-center"><p>Não foi possível carregar o painel completo.</p><Button variant="outline" onClick={() => setRetry((v) => v + 1)}>Tentar novamente</Button></div> : <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-moss/25 bg-moss/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-moss"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Pago{period === "all" ? " · todo o histórico" : " no mês"}</span></div>
              <p className="break-words text-2xl font-semibold tabular-nums text-moss">{money(totals.paid)}</p>
              <p className="mt-1 text-xs text-foreground/70">{paidRows.length} {paidRows.length === 1 ? "sessão quitada" : "sessões quitadas"}</p>
            </div>
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-destructive"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Em aberto{period === "all" ? " · todo o histórico" : " no mês"}</span></div>
              <p className="break-words text-2xl font-semibold tabular-nums text-destructive">{money(totals.pending)}</p>
              <p className="mt-1 text-xs text-foreground/70">{pendingRows.length} {pendingRows.length === 1 ? "cobrança pendente" : "cobranças pendentes"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-5 text-sm text-foreground/80">
            <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-primary" /> {period === "all" ? "Total pago + em aberto" : "Previsto total do mês"}: <strong className="tabular-nums text-primary">{money(totals.total)}</strong></span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Previsto avulso futuro: <strong className="tabular-nums">{money(totals.forecast)}</strong></span>
            <span>{periodRows.length} sessões · {totals.completed} realizadas</span>
            <span className={totals.receipts > 0 ? "text-destructive" : ""}>{totals.receipts} Receita Saúde a emitir</span>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger value="sessions" className="gap-2 py-2"><CalendarDays className="h-4 w-4" /> Sessões</TabsTrigger>
              <TabsTrigger value="billing" className="gap-2 py-2"><Receipt className="h-4 w-4" /> Cobranças</TabsTrigger>
              <TabsTrigger value="history" className="gap-2 py-2"><History className="h-4 w-4" /> Alterações</TabsTrigger>
              <TabsTrigger value="messages" className="gap-2 py-2"><MessageCircle className="h-4 w-4" /> Mensagens</TabsTrigger>
            </TabsList>
            <TabsContent value="sessions" className="mt-5 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Histórico de sessões</h3><Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filtrar pagamentos do paciente" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="paid">Pagas</SelectItem><SelectItem value="pending">Pendentes</SelectItem></SelectContent></Select></div>
              {shown.length === 0 && <Empty text="Nenhuma sessão neste período e filtro." />}
              {[
                { key: "pending", title: "Em aberto", tone: "text-destructive", rows: shown.filter((s) => s.status !== "cancelled" && s.payment_status !== "paid") },
                { key: "paid", title: "Pagas", tone: "text-moss", rows: shown.filter((s) => s.status !== "cancelled" && s.payment_status === "paid") },
                { key: "cancelled", title: "Canceladas", tone: "text-muted-foreground", rows: shown.filter((s) => s.status === "cancelled") },
              ].filter((g) => g.rows.length > 0).map((g) => <section key={g.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3"><h4 className={`text-sm font-semibold ${g.tone}`}>{g.title} · {g.rows.length}</h4><span className={`text-sm font-semibold tabular-nums ${g.tone}`}>{money(g.rows.reduce((t, s) => t + Number(s.price ?? 0), 0))}</span></div>
                {g.rows.map((s) => <div key={s.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{format(new Date(s.scheduled_at), "dd/MM/yyyy · HH:mm")}</p><p className="mt-1 text-sm text-foreground/75">{s.service?.name ?? (isPlanNotes(s.notes) ? "Plano de Atendimento" : "Sessão avulsa")} · {statusLabels[s.status] ?? s.status}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{money(Number(s.price ?? 0))}</p><span className={`text-xs font-medium ${s.status === "cancelled" ? "text-muted-foreground" : s.payment_status === "paid" ? "text-moss" : "text-destructive"}`}>{s.status === "cancelled" ? "Cancelada" : s.payment_status === "paid" ? "Pago" : "Pendente"}</span></div></div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><p className="text-xs text-foreground/75">{s.paid_at ? `Pago em ${format(new Date(s.paid_at), "dd/MM/yyyy")}` : s.payment_due_date ? `Vencimento ${s.payment_due_date.split("-").reverse().join("/")}` : "Sem vencimento definido"}{s.payment_method ? ` · ${{ pix: "PIX", card: "Cartão", cash: "Dinheiro" }[s.payment_method]}` : ""}{s.receita_saude_status ? ` · Receita Saúde ${s.receita_saude_status === "issued" ? "emitida" : "a emitir"}` : ""}</p><Button variant="outline" size="sm" onClick={() => manage(s)}><Wallet /> Pagamento e cobrança</Button></div>
                </div>)}
              </section>)}
            </TabsContent>
            <TabsContent value="billing" className="mt-5 space-y-3"><h3 className="font-semibold">Situação das cobranças</h3>{periodRows.filter((s) => s.status !== "cancelled").length === 0 && <Empty text="Ainda não há cobranças neste período." />}{periodRows.filter((s) => s.status !== "cancelled").map((s) => { const billing = computeBillingStatus([s], undefined, isPlanNotes(s.notes) ? "plan" : "per_session"); return <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><div><p className="text-sm font-semibold">{format(new Date(s.scheduled_at), "dd/MM/yyyy")} · {money(Number(s.price ?? 0))}</p><p className="mt-1 text-xs text-foreground/75">{s.billing_sent_at ? `Último envio em ${format(new Date(s.billing_sent_at), "dd/MM/yyyy 'às' HH:mm")}` : "Sem envio registrado"}</p></div><BillingBadge status={billing.status} dueDate={billing.dueDate} /><Button size="sm" variant="outline" onClick={() => manage(s)}>Ver cobrança</Button></div>; })}</TabsContent>
            <TabsContent value="history" className="mt-5 space-y-3"><h3 className="font-semibold">Histórico de alterações financeiras</h3>{history.length === 0 && <Empty text="Nenhuma alteração financeira registrada neste período." />}<ol className="divide-y divide-border">{history.map((c) => <li key={c.id} className="flex gap-3 py-4"><History className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm font-semibold">{paymentChangeLabel[c.action] ?? "Alteração financeira"}</p><p className="mt-1 text-xs text-foreground/75">{format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm")} · {c.actor_name ?? "Você"}</p>{c.label && <p className="mt-1 break-words text-sm text-muted-foreground">{c.label}</p>}</div></li>)}</ol></TabsContent>
            <TabsContent value="messages" className="mt-5 space-y-3"><h3 className="font-semibold">Mensagens · todo o histórico</h3>{patient && <PatientWhatsAppLog patientId={patient.id} />}</TabsContent>
          </Tabs>
        </div>}
      </div>
    </SheetContent>
  </Sheet>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center"><FileText className="mx-auto mb-3 h-6 w-6 text-primary" /><p className="text-sm text-muted-foreground">{text}</p></div>;
}