import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, DollarSign, CheckCircle2, Clock, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SessionHistoryProps {
  patientId: string;
}

interface SessionRow {
  id: string;
  scheduled_at: string;
  status: string;
  duration_minutes: number;
  price: number | null;
  notes: string | null;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
}

const statusLabel: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};

const statusIcon: Record<string, React.ReactNode> = {
  scheduled: <Clock className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5" />,
  no_show: <XCircle className="h-3.5 w-3.5" />,
  rescheduled: <RotateCcw className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
};

const statusColor: Record<string, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-lilac text-lilac-foreground",
  no_show: "bg-destructive/15 text-destructive",
  rescheduled: "bg-sand text-sand-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const paymentLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  waived: "Isento",
};

const paymentColor: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  paid: "text-emerald-700 bg-emerald-50",
  overdue: "text-destructive bg-destructive/10",
  waived: "text-muted-foreground bg-muted",
};

const SessionCard = ({ s }: { s: SessionRow }) => (
  <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="text-center shrink-0 w-12">
        <p className="text-lg font-display font-bold text-foreground leading-none">
          {format(new Date(s.scheduled_at), "dd")}
        </p>
        <p className="text-[10px] uppercase text-muted-foreground">
          {format(new Date(s.scheduled_at), "MMM", { locale: ptBR })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {format(new Date(s.scheduled_at), "HH:mm")}
          </span>
          <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
          <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor[s.status] ?? "bg-muted text-muted-foreground")}>
            {statusIcon[s.status]} {statusLabel[s.status] ?? s.status}
          </span>
        </div>
        {s.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.notes}</p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      {s.price != null && (
        <span className="text-xs font-medium text-foreground">
          R$ {Number(s.price).toFixed(2).replace(".", ",")}
        </span>
      )}
      <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium", paymentColor[s.payment_status] ?? "bg-muted text-muted-foreground")}>
        <DollarSign className="h-3 w-3" />
        {paymentLabel[s.payment_status] ?? s.payment_status}
      </span>
    </div>
  </div>
);

export const PatientSessionHistory = ({ patientId }: SessionHistoryProps) => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sessions")
        .select("id, scheduled_at, status, duration_minutes, price, notes, payment_status, payment_method, paid_at")
        .eq("patient_id", patientId)
        .order("scheduled_at", { ascending: false });
      setSessions(data ?? []);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
      </div>
    );
  }

  // Group by status
  const byStatus: Record<string, SessionRow[]> = {};
  sessions.forEach((s) => {
    const key = s.status;
    if (!byStatus[key]) byStatus[key] = [];
    byStatus[key].push(s);
  });

  // Group by payment
  const byPayment: Record<string, SessionRow[]> = {};
  sessions.forEach((s) => {
    const key = s.payment_status;
    if (!byPayment[key]) byPayment[key] = [];
    byPayment[key].push(s);
  });

  // Summary stats
  const completed = sessions.filter(s => s.status === "completed").length;
  const noShow = sessions.filter(s => s.status === "no_show").length;
  const paid = sessions.filter(s => s.payment_status === "paid").length;
  const pending = sessions.filter(s => s.payment_status === "pending").length;
  const totalRevenue = sessions.filter(s => s.payment_status === "paid" && s.price).reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-muted/30 p-3 text-center">
          <p className="text-lg font-display font-bold text-foreground">{sessions.length}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-lg font-display font-bold text-emerald-700">{completed}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Realizadas</p>
        </div>
        <div className="rounded-xl bg-destructive/10 p-3 text-center">
          <p className="text-lg font-display font-bold text-destructive">{noShow}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Faltas</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-lg font-display font-bold text-emerald-700">R$ {totalRevenue.toFixed(0)}</p>
          <p className="text-[10px] uppercase text-muted-foreground">Recebido</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="payment">Por Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2 mt-3">
          {sessions.map((s) => <SessionCard key={s.id} s={s} />)}
        </TabsContent>

        <TabsContent value="status" className="space-y-4 mt-3">
          {Object.entries(byStatus).map(([status, items]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", statusColor[status] ?? "bg-muted text-muted-foreground")}>
                  {statusIcon[status]} {statusLabel[status] ?? status}
                </span>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map((s) => <SessionCard key={s.id} s={s} />)}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="payment" className="space-y-4 mt-3">
          {Object.entries(byPayment).map(([payment, items]) => (
            <div key={payment}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", paymentColor[payment] ?? "bg-muted text-muted-foreground")}>
                  <DollarSign className="h-3 w-3" /> {paymentLabel[payment] ?? payment}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({items.length}) — R$ {items.filter(s => s.price).reduce((sum, s) => sum + Number(s.price), 0).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((s) => <SessionCard key={s.id} s={s} />)}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
