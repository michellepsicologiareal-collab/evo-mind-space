import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ReminderSettings {
  enabled: boolean;
  frequency: "daily" | "weekly";
  weekday: number;
  remind_time: string;
  include_checkin: boolean;
}

const DEFAULTS: ReminderSettings = { enabled: false, frequency: "daily", weekday: 1, remind_time: "20:00", include_checkin: true };
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DISMISS_KEY = "selfcare-reminder-dismissed";

/** Último momento agendado (<= agora) segundo a recorrência. */
export const lastScheduledMoment = (s: ReminderSettings, now = new Date()) => {
  const [h, m] = s.remind_time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  if (s.frequency === "daily") {
    if (d > now) d.setDate(d.getDate() - 1);
  } else {
    let diff = (d.getDay() - s.weekday + 7) % 7;
    d.setDate(d.getDate() - diff);
    if (d > now) d.setDate(d.getDate() - 7);
  }
  return d;
};

/** Painel de configuração dentro do Autocuidado. */
export function SelfcareReminderSettings() {
  const { user } = useAuth();
  const [s, setS] = useState<ReminderSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("selfcare_reminders").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setS({ enabled: data.enabled, frequency: data.frequency as ReminderSettings["frequency"], weekday: data.weekday, remind_time: data.remind_time, include_checkin: data.include_checkin });
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("selfcare_reminders").upsert({ user_id: user.id, ...s });
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar o lembrete.");
    localStorage.removeItem(DISMISS_KEY);
    window.dispatchEvent(new Event("selfcare-reminder-updated"));
    toast.success(s.enabled ? "Lembrete salvo 💛" : "Lembretes desativados");
  };

  if (loading) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><BellRing className="h-4 w-4" /></span>
          <div>
            <h3 className="font-display font-semibold text-foreground">Lembretes de autocuidado</h3>
            <p className="text-xs text-muted-foreground">Um convite gentil para registrar seu RPD e cuidar de você.</p>
          </div>
        </div>
        <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} aria-label="Ativar lembretes" />
      </div>

      {s.enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select value={s.frequency} onValueChange={(v) => setS({ ...s, frequency: v as ReminderSettings["frequency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Todo dia</SelectItem>
                <SelectItem value="weekly">Toda semana</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {s.frequency === "weekly" && (
            <div className="space-y-1.5">
              <Label>Dia da semana</Label>
              <Select value={String(s.weekday)} onValueChange={(v) => setS({ ...s, weekday: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rem-time">Horário</Label>
            <Input id="rem-time" type="time" value={s.remind_time} onChange={(e) => setS({ ...s, remind_time: e.target.value || "20:00" })} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 sm:col-span-3">
            <p className="text-sm text-foreground">Lembrar também do check-in de autocuidado</p>
            <Switch checked={s.include_checkin} onCheckedChange={(v) => setS({ ...s, include_checkin: v })} />
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">O lembrete aparece aqui no PsiReal quando você abrir o app após o horário escolhido, se ainda não tiver registrado.</p>
      <div className="flex justify-end">
        <Button variant="accent" onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar lembrete
        </Button>
      </div>
    </section>
  );
}

/** Verifica periodicamente e mostra o lembrete quando estiver pendente. */
export function SelfcareReminderWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      const { data: cfg } = await supabase.from("selfcare_reminders").select("*").eq("user_id", user.id).maybeSingle();
      if (cancelled || !cfg?.enabled) return;
      const due = lastScheduledMoment(cfg as unknown as ReminderSettings);
      if (due < new Date(cfg.created_at)) return;
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissed >= due.getTime()) return;

      const [{ data: rpd }, { data: chk }] = await Promise.all([
        supabase.from("therapist_rpd_records").select("created_at").eq("user_id", user.id).gte("created_at", due.toISOString()).limit(1),
        cfg.include_checkin
          ? supabase.from("selfcare_checkins").select("id").eq("user_id", user.id).gte("checked_at", due.toISOString().slice(0, 10)).limit(1)
          : Promise.resolve({ data: [{ id: "skip" }] }),
      ]);
      if (cancelled) return;
      const needRpd = !rpd?.length;
      const needCheckin = !chk?.length;
      if (!needRpd && !needCheckin) return;

      const parts = [needRpd && "registrar seu RPD", needCheckin && "fazer seu check-in"].filter(Boolean).join(" e ");
      localStorage.setItem(DISMISS_KEY, String(due.getTime()));
      toast("Hora de cuidar de você, Psi 💛", {
        id: "selfcare-reminder",
        description: `Que tal reservar alguns minutos para ${parts}?`,
        duration: 15000,
        action: { label: "Abrir", onClick: () => navigate("/app/autocuidado") },
      });
    };

    void check();
    const interval = window.setInterval(check, 5 * 60_000);
    const onUpd = () => void check();
    window.addEventListener("selfcare-reminder-updated", onUpd);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("selfcare-reminder-updated", onUpd); };
  }, [user, navigate]);

  return null;
}
