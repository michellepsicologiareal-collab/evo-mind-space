import { useEffect, useState, useMemo } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Check, X, RotateCcw, Trash2, Link2, CheckCircle2 } from "lucide-react";
import { addDays, addWeeks, format, isSameDay, startOfWeek, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Status = "scheduled" | "completed" | "no_show" | "rescheduled" | "cancelled" | "confirmed";
type SessionType = "clinical" | "supervision";

interface Session {
  id: string;
  patient_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: Status;
  price: number | null;
  notes: string | null;
  confirmation_token: string | null;
  session_type: SessionType;
  discussed_patient_id: string | null;
  is_expense: boolean;
  patient_name?: string | null;
  discussed_patient_name?: string | null;
}

interface Patient {
  id: string;
  full_name: string;
  session_price: number | null;
}

const sessionSchema = z
  .object({
    session_type: z.enum(["clinical", "supervision"]).default("clinical"),
    patient_id: z.string().optional(),
    discussed_patient_id: z.string().optional(),
    date: z.string().min(1, "Selecione a data"),
    time: z.string().min(1, "Selecione o horário"),
    duration_minutes: z.number().int().positive().max(480),
    price: z.string().optional(),
    notes: z.string().max(2000).optional(),
    payment_method: z.enum(["none", "pix", "card", "cash"]).default("none"),
    payment_reference: z.string().max(500).optional(),
    mood_score: z.string().optional(),
    progress_note: z.string().max(2000).optional(),
  })
  .refine(
    (d) => d.session_type === "supervision" || (d.patient_id && d.patient_id.length > 0),
    { path: ["patient_id"], message: "Selecione um paciente" }
  )
  .refine(
    (d) =>
      !(d.payment_method === "pix" || d.payment_method === "card") ||
      (d.payment_reference?.trim().length ?? 0) > 0,
    {
      path: ["payment_reference"],
      message: "Informe a referência do pagamento (obrigatório para PIX e cartão).",
    }
  );


const statusLabel: Record<Status, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};

const statusClass: Record<Status, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-lilac text-lilac-foreground",
  no_show: "bg-destructive/15 text-destructive",
  rescheduled: "bg-sand text-sand-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const Agenda = () => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    session_type: "clinical" as SessionType,
    patient_id: "",
    discussed_patient_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    duration_minutes: 50,
    price: "",
    notes: "",
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "",
    mood_score: "",
    progress_note: "",
  });


  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const weekEnd = addDays(weekStart, 7);
    const [sRes, pRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, session_type, discussed_patient_id, is_expense, patient:patients!sessions_patient_id_fkey(full_name), discussed_patient:patients!sessions_discussed_patient_id_fkey(full_name)")
        .eq("user_id", user.id)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("patients").select("id, full_name, session_price").eq("user_id", user.id).eq("is_active", true).order("full_name"),
    ]);
    if (sRes.error) toast.error("Erro ao carregar sessões");
    const mapped = (sRes.data ?? []).map((s: any) => ({
      ...s,
      patient_name: s.patient?.full_name ?? null,
      discussed_patient_name: s.discussed_patient?.full_name ?? null,
    }));
    setSessions(mapped as Session[]);
    setPatients((pRes.data as Patient[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart]);

  const openNew = (date?: Date) => {
    setForm({
      session_type: "clinical",
      patient_id: "",
      discussed_patient_id: "",
      date: format(date ?? new Date(), "yyyy-MM-dd"),
      time: "09:00",
      duration_minutes: 50,
      price: "",
      notes: "",
      payment_method: "none",
      payment_reference: "",
      mood_score: "",
      progress_note: "",
    });
    setOpen(true);
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = sessionSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const isSupervision = parsed.data.session_type === "supervision";
    const scheduledAt = parse(`${parsed.data.date} ${parsed.data.time}`, "yyyy-MM-dd HH:mm", new Date());
    const patient = patients.find((p) => p.id === parsed.data.patient_id);
    const price = parsed.data.price ? Number(parsed.data.price) : (isSupervision ? null : patient?.session_price ?? null);

    const ref = parsed.data.payment_reference?.trim() ?? "";
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        patient_id: isSupervision ? null : (parsed.data.patient_id || null),
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parsed.data.duration_minutes,
        price,
        notes: parsed.data.notes || null,
        payment_method: parsed.data.payment_method === "none" ? null : parsed.data.payment_method,
        payment_reference: ref.length > 0 ? ref : null,
        session_type: parsed.data.session_type,
        discussed_patient_id: isSupervision && parsed.data.discussed_patient_id ? parsed.data.discussed_patient_id : null,
        is_expense: isSupervision,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      toast.error("Erro ao agendar sessão");
      return;
    }

    const moodNum = parsed.data.mood_score ? Number(parsed.data.mood_score) : null;
    const progressNote = parsed.data.progress_note?.trim() || null;
    if (!isSupervision && parsed.data.patient_id && ((moodNum && moodNum >= 1 && moodNum <= 10) || progressNote)) {
      await supabase.from("patient_progress").insert({
        user_id: user.id,
        patient_id: parsed.data.patient_id,
        session_id: created?.id ?? null,
        mood_score: moodNum,
        note: progressNote,
        recorded_at: scheduledAt.toISOString(),
      });
    }

    setSaving(false);
    toast.success("Sessão agendada");
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("sessions").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(`Marcada como ${statusLabel[status].toLowerCase()}`);
    load();
  };

  const removeSession = async (id: string) => {
    if (!confirm("Excluir esta sessão?")) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Sessão excluída");
    load();
  };

  const copyConfirmationLink = async (s: Session) => {
    let token = s.confirmation_token;
    if (!token) {
      // Generate a token
      token = crypto.randomUUID();
      const { error } = await supabase
        .from("sessions")
        .update({ confirmation_token: token })
        .eq("id", s.id);
      if (error) { toast.error("Erro ao gerar link"); return; }
    }
    const url = `${window.location.origin}/confirmar-sessao/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link de confirmação copiado!");
    load();
  };

  const sessionsByDay = (date: Date) => sessions.filter((s) => isSameDay(new Date(s.scheduled_at), date));

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-medium">Agenda</h1>
          <p className="mt-2 text-muted-foreground">Visualize e organize seus atendimentos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Nova sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Nova sessão</DialogTitle>
            </DialogHeader>
            {patients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Cadastre um paciente ativo antes de agendar.</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input id="date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Horário *</Label>
                    <Input id="time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dur">Duração (min)</Label>
                    <Input id="dur" type="number" min="10" max="480" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Valor (R$)</Label>
                    <Input id="price" type="number" step="0.01" min="0" placeholder="Auto" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Método pagamento</Label>
                    <Select
                      value={form.payment_method}
                      onValueChange={(v) => setForm({ ...form, payment_method: v as typeof form.payment_method })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="card">Cartão</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payref">
                      Referência
                      {(form.payment_method === "pix" || form.payment_method === "card") && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id="payref"
                      maxLength={500}
                      placeholder={
                        form.payment_method === "pix"
                          ? "Ex.: comprovante, ID"
                          : form.payment_method === "card"
                          ? "Ex.: NSU, últimos 4"
                          : "Opcional"
                      }
                      value={form.payment_reference}
                      onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Humor / Progresso (opcional)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="mood">Humor (1-10)</Label>
                      <Input
                        id="mood"
                        type="number"
                        min="1"
                        max="10"
                        placeholder="—"
                        value={form.mood_score}
                        onChange={(e) => setForm({ ...form, mood_score: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="prog">Nota de progresso</Label>
                      <Input
                        id="prog"
                        maxLength={2000}
                        placeholder="Ex.: melhora no sono"
                        value={form.progress_note}
                        onChange={(e) => setForm({ ...form, progress_note: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" variant="hero" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Agendar
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex items-center justify-between rounded-2xl bg-card border border-border shadow-card p-4">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold capitalize">
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(weekStart, "dd/MM")} — {format(addDays(weekStart, 6), "dd/MM")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((day) => {
            const items = sessionsByDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={cn("rounded-2xl border p-3 min-h-[200px] flex flex-col", isToday ? "bg-card border-primary/40" : "bg-card border-border")}>
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                  <p className={cn("font-display text-xl", isToday ? "text-accent" : "text-foreground")}>{format(day, "dd")}</p>
                </div>
                <div className="space-y-2 flex-1">
                  {items.length === 0 ? (
                    <button onClick={() => openNew(day)} className="w-full text-xs text-muted-foreground/60 hover:text-accent border border-dashed border-border rounded-xl py-3 transition-colors">
                      + adicionar
                    </button>
                  ) : (
                    items.map((s) => (
                      <div key={s.id} className={cn("rounded-xl border p-3 group transition-colors", s.status === "confirmed" ? "bg-emerald-50 border-emerald-200" : "bg-background border-border")}>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            {s.status === "confirmed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                            <p className="font-display text-sm text-primary">{format(new Date(s.scheduled_at), "HH:mm")}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">⋯</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyConfirmationLink(s)}><Link2 className="h-4 w-4" /> Enviar link de confirmação</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateStatus(s.id, "completed")}><Check className="h-4 w-4" /> Realizada</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(s.id, "no_show")}><X className="h-4 w-4" /> Falta</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(s.id, "rescheduled")}><RotateCcw className="h-4 w-4" /> Remarcada</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(s.id, "cancelled")}>Cancelada</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => removeSession(s.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-foreground mt-1 truncate">{s.patients?.full_name}</p>
                        <span className={cn("inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full", statusClass[s.status])}>{statusLabel[s.status]}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-14 text-center">
          <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 font-display text-lg font-medium text-foreground/70">Semana livre</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhuma sessão agendada para esta semana. Aproveite para planejar!</p>
        </div>
      )}
    </div>
  );
};

export default Agenda;
