import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, DollarSign, CheckCircle2, Clock, XCircle, RotateCcw, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface SessionHistoryProps {
  patientId: string;
  patientName?: string;
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

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const generatePDF = (sessions: SessionRow[], patientName: string) => {
  const completed = sessions.filter(s => s.status === "completed").length;
  const noShow = sessions.filter(s => s.status === "no_show").length;
  const paid = sessions.filter(s => s.payment_status === "paid").length;
  const totalRevenue = sessions.filter(s => s.payment_status === "paid" && s.price).reduce((sum, s) => sum + Number(s.price), 0);
  const totalPending = sessions.filter(s => s.payment_status === "pending" && s.price).reduce((sum, s) => sum + Number(s.price), 0);

  // Create a printable HTML and trigger print (PDF)
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const safeName = escapeHtml(patientName);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Histórico - ${safeName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 4px; color: #A57164; }
        h2 { font-size: 14px; margin: 20px 0 8px; color: #3D5C35; }
        .meta { color: #888; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .summary-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card .value { font-size: 20px; font-weight: 700; }
        .summary-card .label { font-size: 10px; text-transform: uppercase; color: #888; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; border-bottom: 2px solid #e5e5e5; padding: 8px 6px; }
        td { padding: 8px 6px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
        tr:nth-child(even) { background: #fafafa; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .badge-completed { background: #E8F5E9; color: #2E7D32; }
        .badge-scheduled, .badge-confirmed { background: #F3F4F6; color: #4B5563; }
        .badge-no_show { background: #FFEBEE; color: #C62828; }
        .badge-cancelled { background: #F5F5F5; color: #9E9E9E; }
        .badge-rescheduled { background: #FFF8E1; color: #F57F17; }
        .badge-paid { background: #E8F5E9; color: #2E7D32; }
        .badge-pending { background: #FFF8E1; color: #E65100; }
        .badge-overdue { background: #FFEBEE; color: #C62828; }
        .badge-waived { background: #F5F5F5; color: #9E9E9E; }
        .footer { margin-top: 30px; text-align: center; color: #bbb; font-size: 10px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>Histórico de Sessões</h1>
      <p class="meta">Paciente: <strong>${safeName}</strong> · Gerado em ${escapeHtml(format(new Date(), "dd/MM/yyyy 'às' HH:mm"))}</p>

      <div class="summary">
        <div class="summary-card"><div class="value">${sessions.length}</div><div class="label">Total</div></div>
        <div class="summary-card"><div class="value" style="color:#2E7D32">${completed}</div><div class="label">Realizadas</div></div>
        <div class="summary-card"><div class="value" style="color:#C62828">${noShow}</div><div class="label">Faltas</div></div>
        <div class="summary-card"><div class="value" style="color:#2E7D32">R$ ${totalRevenue.toFixed(0)}</div><div class="label">Recebido</div></div>
      </div>

      <h2>Detalhamento</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Horário</th><th>Duração</th><th>Status</th><th>Pagamento</th><th>Valor</th></tr>
        </thead>
        <tbody>
          ${sessions.map(s => {
            const statusKey = escapeHtml(s.status);
            const paymentKey = escapeHtml(s.payment_status);
            const statusText = escapeHtml(statusLabel[s.status] ?? s.status);
            const paymentText = escapeHtml(paymentLabel[s.payment_status] ?? s.payment_status);
            const priceText = s.price != null ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}` : "—";
            return `
            <tr>
              <td>${escapeHtml(format(new Date(s.scheduled_at), "dd/MM/yyyy"))}</td>
              <td>${escapeHtml(format(new Date(s.scheduled_at), "HH:mm"))}</td>
              <td>${Number(s.duration_minutes) || 0} min</td>
              <td><span class="badge badge-${statusKey}">${statusText}</span></td>
              <td><span class="badge badge-${paymentKey}">${paymentText}</span></td>
              <td>${priceText}</td>
            </tr>
          `;}).join("")}
        </tbody>
      </table>

      <div class="footer">
        <p>Psi Real · Relatório gerado automaticamente</p>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 300);
};

export const PatientSessionHistory = ({ patientId, patientName = "Paciente" }: SessionHistoryProps) => {
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

  const byStatus: Record<string, SessionRow[]> = {};
  sessions.forEach((s) => {
    const key = s.status;
    if (!byStatus[key]) byStatus[key] = [];
    byStatus[key].push(s);
  });

  const byPayment: Record<string, SessionRow[]> = {};
  sessions.forEach((s) => {
    const key = s.payment_status;
    if (!byPayment[key]) byPayment[key] = [];
    byPayment[key].push(s);
  });

  const completed = sessions.filter(s => s.status === "completed").length;
  const noShow = sessions.filter(s => s.status === "no_show").length;
  const totalRevenue = sessions.filter(s => s.payment_status === "paid" && s.price).reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="space-y-4">
      {/* PDF button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => generatePDF(sessions, patientName)}>
          <FileDown className="h-3.5 w-3.5" /> Gerar PDF
        </Button>
      </div>

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
