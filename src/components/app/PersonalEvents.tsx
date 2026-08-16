import { useCallback, useEffect, useState } from "react";
import { format, isSameDay, differenceInCalendarDays, differenceInCalendarMonths, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Trash2, Briefcase, Heart, GraduationCap, Wallet, Sparkles, Plane, Clock, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PersonalEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  duration_minutes: number;
  all_day: boolean;
  recurrence?: string | null;
  recurrence_interval?: number | null;
  recurrence_until?: string | null;
  /** Preenchido quando o item é uma ocorrência gerada por recorrência. */
  occurrence_date?: string;
}

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Não se repete" },
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
] as const;

export const recurrenceLabel = (ev: PersonalEvent) => {
  const r = ev.recurrence ?? "none";
  if (r === "none") return null;
  const n = ev.recurrence_interval ?? 1;
  if (r === "daily") return n === 1 ? "Todo dia" : `A cada ${n} dias`;
  if (r === "weekly") return n === 1 ? "Toda semana" : `A cada ${n} semanas`;
  return n === 1 ? "Todo mês" : `A cada ${n} meses`;
};


export const PERSONAL_CATEGORIES = [
  { value: "pessoal", label: "Pessoal", icon: Sparkles, chip: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  { value: "saude", label: "Saúde", icon: Heart, chip: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  { value: "estudo", label: "Estudo / formação", icon: GraduationCap, chip: "bg-indigo-50 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  { value: "administrativo", label: "Administrativo", icon: Briefcase, chip: "bg-slate-100 text-slate-800 border-slate-300", dot: "bg-slate-500" },
  { value: "financeiro", label: "Financeiro", icon: Wallet, chip: "bg-orange-50 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  { value: "folga", label: "Folga / viagem", icon: Plane, chip: "bg-cyan-50 text-cyan-800 border-cyan-200", dot: "bg-cyan-500" },
] as const;

export const categoryMeta = (value: string) =>
  PERSONAL_CATEGORIES.find((c) => c.value === value) ?? PERSONAL_CATEGORIES[0];

/** Carrega os compromissos pessoais do usuário (todos, filtrados no cliente por dia). */
export const usePersonalEvents = (userId: string | undefined) => {
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("personal_events")
      .select("id, title, description, category, starts_at, duration_minutes, all_day, recurrence, recurrence_interval, recurrence_until")
      .eq("user_id", userId)
      .order("starts_at", { ascending: true });
    if (error) toast.error("Não foi possível carregar os compromissos pessoais");
    setEvents((data as PersonalEvent[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  return { events, loading, reload };
};

/** Indica se um compromisso (com ou sem recorrência) acontece na data informada. */
export const occursOn = (event: PersonalEvent, date: Date) => {
  const start = new Date(event.starts_at);
  if (isSameDay(start, date)) return true;

  const rule = event.recurrence ?? "none";
  if (rule === "none") return false;

  const day = startOfDay(date);
  if (day < startOfDay(start)) return false;
  if (event.recurrence_until) {
    const until = startOfDay(parseISO(event.recurrence_until));
    if (day > until) return false;
  }

  const step = Math.max(1, event.recurrence_interval ?? 1);
  if (rule === "daily") return differenceInCalendarDays(day, startOfDay(start)) % step === 0;
  if (rule === "weekly") {
    const diff = differenceInCalendarDays(day, startOfDay(start));
    return diff % 7 === 0 && (diff / 7) % step === 0;
  }
  // mensal: mesmo dia do mês (ou último dia, quando o mês é mais curto)
  const months = differenceInCalendarMonths(day, start);
  if (months <= 0 || months % step !== 0) return false;
  const lastDayOfMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  const targetDay = Math.min(start.getDate(), lastDayOfMonth);
  return day.getDate() === targetDay;
};

export const eventsForDay = (events: PersonalEvent[], date: Date): PersonalEvent[] =>
  events
    .filter((e) => occursOn(e, date))
    .map((e) => {
      if (isSameDay(new Date(e.starts_at), date)) return e;
      const start = new Date(e.starts_at);
      const occ = new Date(date);
      occ.setHours(start.getHours(), start.getMinutes(), 0, 0);
      return { ...e, starts_at: occ.toISOString(), occurrence_date: format(date, "yyyy-MM-dd") };
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));


/** Cartão compacto de compromisso pessoal — cor distinta das sessões de pacientes. */
export const PersonalEventCard = ({
  event,
  onClick,
  compact = false,
}: {
  event: PersonalEvent;
  onClick?: () => void;
  compact?: boolean;
}) => {
  const meta = categoryMeta(event.category);
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border-l-4 border border-amber-200/70 bg-amber-50/60 transition-colors hover:bg-amber-50",
        compact ? "px-3 py-2" : "px-3 py-3 sm:px-4",
      )}
      style={{ borderLeftColor: "hsl(38 92% 50%)" }}
    >
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-xs font-semibold text-amber-900">
              {event.all_day ? "Dia todo" : format(new Date(event.starts_at), "HH:mm")}
            </span>
            <span className="text-sm font-medium text-foreground truncate">{event.title}</span>
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", meta.chip)}>
              {meta.label}
            </span>
          </div>
          {event.description && !compact && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">{event.description}</p>
          )}
          {!event.all_day && !compact && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {event.duration_minutes} min
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | undefined;
  defaultDate: Date;
  event: PersonalEvent | null;
  onSaved: () => void;
}

export const PersonalEventDialog = ({ open, onOpenChange, userId, defaultDate, event, onSaved }: DialogProps) => {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "pessoal",
    date: format(defaultDate, "yyyy-MM-dd"),
    time: "09:00",
    duration: "60",
    allDay: false,
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      const dt = new Date(event.starts_at);
      setForm({
        title: event.title,
        description: event.description ?? "",
        category: event.category,
        date: format(dt, "yyyy-MM-dd"),
        time: format(dt, "HH:mm"),
        duration: String(event.duration_minutes),
        allDay: event.all_day,
      });
    } else {
      setForm({
        title: "",
        description: "",
        category: "pessoal",
        date: format(defaultDate, "yyyy-MM-dd"),
        time: "09:00",
        duration: "60",
        allDay: false,
      });
    }
  }, [open, event, defaultDate]);

  const save = async () => {
    if (!userId) return;
    if (!form.title.trim()) {
      toast.error("Escreva um título para o compromisso");
      return;
    }
    setSaving(true);
    const startsAt = new Date(`${form.date}T${form.allDay ? "00:00" : form.time}:00`);
    const payload = {
      user_id: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      starts_at: startsAt.toISOString(),
      duration_minutes: form.allDay ? 0 : Number(form.duration) || 60,
      all_day: form.allDay,
    };
    const { error } = event
      ? await supabase.from("personal_events").update(payload).eq("id", event.id)
      : await supabase.from("personal_events").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(event ? "Compromisso atualizado" : "Compromisso adicionado à agenda");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!event) return;
    setDeleting(true);
    const { error } = await supabase.from("personal_events").delete().eq("id", event.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compromisso removido");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {event ? "Editar compromisso pessoal" : "Novo compromisso pessoal"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pe-title">Título</Label>
            <Input
              id="pe-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Dentista, supervisão pessoal, academia..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONAL_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pe-date">Data</Label>
              <Input
                id="pe-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-time">Horário</Label>
              <Input
                id="pe-time"
                type="time"
                disabled={form.allDay}
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Dia todo</p>
              <p className="text-xs text-muted-foreground">Sem horário específico</p>
            </div>
            <Switch checked={form.allDay} onCheckedChange={(v) => setForm((f) => ({ ...f, allDay: v }))} />
          </div>

          {!form.allDay && (
            <div className="space-y-1.5">
              <Label htmlFor="pe-duration">Duração (minutos)</Label>
              <Input
                id="pe-duration"
                type="number"
                min={5}
                step={5}
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pe-desc">Anotações (texto livre)</Label>
            <Textarea
              id="pe-desc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Escreva o que quiser lembrar sobre esse compromisso..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {event ? (
            <Button variant="ghost" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
