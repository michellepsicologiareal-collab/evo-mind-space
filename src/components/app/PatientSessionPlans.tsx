import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Loader2, Plus, Trash2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { planGroupIdOf, renumberPlanNotes, isPlanNotes } from "@/lib/billing";

type Row = {
  id: string; user_id: string; patient_id: string; scheduled_at: string; status: string;
  price: number | null; payment_status: string; notes: string | null; [k: string]: any;
};

const STATUS: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Realizada",
  cancelled: "Cancelada", no_show: "Falta", rescheduled: "Remarcada",
};

export function PatientSessionPlans({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sessions").select("*")
      .eq("patient_id", patientId).ilike("notes", "%Plano %sess%")
      .order("scheduled_at", { ascending: true });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [patientId]);
  useEffect(() => { void load(); }, [load]);

  const plans = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = planGroupIdOf(r.notes) ?? (r.notes?.match(/Plano \d+ sess\S*/)?.[0] ?? "outros");
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries())
      .map(([key, list]) => ({ key, list, hasGid: !!planGroupIdOf(list[0].notes), single: isPlanNotes(list[0].notes) }))
      .sort((a, b) => b.list[0].scheduled_at.localeCompare(a.list[0].scheduled_at));
  }, [rows]);

  const renumber = async (list: Row[]) => {
    const sorted = [...list].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    await Promise.all(sorted.map((s, i) =>
      supabase.from("sessions").update({ notes: renumberPlanNotes(s.notes || "", i + 1, sorted.length) }).eq("id", s.id)));
  };

  const changeDate = async (s: Row, d: Date, list: Row[]) => {
    const old = new Date(s.scheduled_at);
    const nd = new Date(d); nd.setHours(old.getHours(), old.getMinutes(), 0, 0);
    setBusy(s.id);
    const { error } = await supabase.from("sessions").update({ scheduled_at: nd.toISOString() }).eq("id", s.id);
    if (error) { toast.error("Erro ao alterar a data"); setBusy(null); return; }
    await renumber(list.map((x) => (x.id === s.id ? { ...x, scheduled_at: nd.toISOString() } : x)));
    toast.success(`Sessão movida para ${format(nd, "dd/MM")}`);
    setBusy(null); void load();
  };

  const addSession = async (list: Row[]) => {
    const last = [...list].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).at(-1)!;
    const { id, created_at, updated_at, confirmation_token, confirmation_responded_at, paid_at, billing_sent_at, ...rest } = last as any;
    const nd = addDays(new Date(last.scheduled_at), 7);
    setBusy("add");
    const { data, error } = await supabase.from("sessions").insert({
      ...rest, scheduled_at: nd.toISOString(), status: "scheduled", payment_status: last.payment_status === "paid" && isPlanNotes(last.notes) ? "pending" : "pending",
      payment_due_date: rest.payment_due_date ?? format(nd, "yyyy-MM-dd"),
    } as any).select("*").single();
    if (error || !data) { toast.error("Erro ao incluir sessão"); setBusy(null); return; }
    await renumber([...list, data as Row]);
    toast.success(`Sessão incluída em ${format(nd, "dd/MM")} — pacote com ${list.length + 1} sessões`);
    setBusy(null); void load();
  };

  const removeSession = async (s: Row, list: Row[]) => {
    setBusy(s.id);
    await Promise.all([
      supabase.from("patient_progress").delete().eq("session_id", s.id),
      supabase.from("session_gcal_events").delete().eq("session_id", s.id),
      supabase.from("session_records").delete().eq("session_id", s.id),
      supabase.from("session_evolutions").delete().eq("session_id", s.id),
    ]);
    const { error } = await supabase.from("sessions").delete().eq("id", s.id);
    if (error) { toast.error("Erro ao excluir"); setBusy(null); return; }
    const rest = list.filter((x) => x.id !== s.id);
    if (rest.length) await renumber(rest);
    toast.success(`Sessão excluída — pacote com ${rest.length} sessão(ões)`);
    setBusy(null); setToDelete(null); void load();
  };

  if (loading) return null;

  return (
    <div>
      <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" /> Plano de sessões
      </h3>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-border p-4">
          Nenhum pacote de sessões por aqui ainda. Ao agendar sessões recorrentes na Agenda, ele aparece aqui para ajustes.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.slice(0, 4).map(({ key, list, single }) => {
            const total = list.filter((s) => s.status !== "cancelled").reduce((a, s) => a + Number(s.price ?? 0), 0);
            return (
              <div key={key} className="rounded-2xl border border-border bg-card p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {list.length} sessões · {single ? "Pagamento único" : "Por sessão"} · Total R$ {total.toFixed(2)}
                  </p>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => addSession(list)}>
                    {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Incluir sessão
                  </Button>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((s, i) => {
                    const d = new Date(s.scheduled_at);
                    return (
                      <li key={s.id} className="flex items-center gap-2 py-2">
                        <span className="text-xs text-muted-foreground w-8">{i + 1}/{list.length}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 px-2" disabled={!!busy} title="Alterar data">
                              <CalendarDays className="h-4 w-4" />
                              {format(d, "EEE dd/MM 'às' HH:mm", { locale: ptBR })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={d} defaultMonth={d} locale={ptBR}
                              onSelect={(nd) => nd && changeDate(s, nd, list)} initialFocus
                              className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                        <span className="text-xs text-muted-foreground flex-1">{STATUS[s.status] ?? s.status}</span>
                        {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={!!busy}
                            aria-label="Excluir sessão do pacote" onClick={() => setToDelete(s)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta sessão do pacote?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `A sessão de ${format(new Date(toDelete.scheduled_at), "dd/MM")} será removida e o valor dela sai do pacote, que fica com uma sessão a menos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const plan = plans.find((p) => p.list.some((x) => x.id === toDelete?.id));
              if (toDelete && plan) void removeSession(toDelete, plan.list);
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
