import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Plus,
  Bell,
  ArrowRight,
  Video,
  MapPin,
  ClipboardList,
  CalendarX,
  CircleDollarSign,
  UserMinus,
  MoreHorizontal,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Real data types ─── */
interface WeekSession {
  id: string;
  scheduled_at: string;
  status: string;
  modality: string | null;
  patient_name: string;
}

/* ─── Mock data (será substituído por queries reais no próximo passo) ─── */
const KPI = [
  { label: "Pacientes ativos", value: "38", hint: "+3 neste mês", to: "/app/pacientes" },
  { label: "Sessões na semana", value: "15", hint: "5 ainda por realizar", to: "/app/agenda" },
  { label: "Comparecimento", value: "86%", hint: "+6% sobre o mês anterior", to: "/app/agenda" },
];

type TodayItem = {
  id: string;
  time: string;
  name: string;
  session: number;
  mode: "Online" | "Presencial";
  status: "scheduled" | "to-confirm" | "confirmed";
};

const TODAY: TodayItem[] = [
  { id: "1", time: "08:00", name: "Pamela Tanaka", session: 17, mode: "Online", status: "scheduled" },
  { id: "2", time: "09:00", name: "Ingrid Aparecida Maia", session: 6, mode: "Presencial", status: "to-confirm" },
  { id: "3", time: "10:00", name: "Romara M. Miranda", session: 6, mode: "Online", status: "confirmed" },
];

const PENDINGS = [
  { icon: ClipboardList, label: "Registros pendentes", count: 5, to: "/app/registro-sessao" },
  { icon: CalendarX, label: "Sem próxima sessão", count: 3, to: "/app/pacientes?filter=sem-proxima" },
  { icon: CircleDollarSign, label: "Pagamentos atrasados", count: 2, to: "/app/financeiro?filter=atrasados" },
  { icon: UserMinus, label: "Baixa adesão", count: 1, to: "/app/pacientes?filter=baixa-adesao" },
];

const WEEK_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];


/* ─── UI helpers ─── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/* ─── Page ─── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata;
    return (meta?.name || meta?.full_name || user?.email?.split("@")[0] || "Michelle") as string;
  }, [user]);

  const today = useMemo(() => new Date(), []);
  const dateStr = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });
  const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const nextTime = TODAY[0]?.time ?? "—";

  /* ── Sessões reais da semana ── */
  const weekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const weekEnd = useMemo(
    () => endOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const [weekSessions, setWeekSessions] = useState<WeekSession[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const t = new Date();
    const day = t.getDay();
    if (day === 0 || day === 6) return addDays(weekStart, 0); // fim de semana -> segunda
    return t;
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoadingWeek(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, scheduled_at, status, modality, patients(full_name)")
        .eq("user_id", user.id)
        .gte("scheduled_at", weekStart.toISOString())
        .lte("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Não foi possível carregar a agenda da semana");
        setWeekSessions([]);
      } else {
        setWeekSessions(
          (data ?? []).map((r: any) => ({
            id: r.id,
            scheduled_at: r.scheduled_at,
            status: r.status,
            modality: r.modality,
            patient_name: r.patients?.full_name ?? "Paciente",
          })),
        );
      }
      setLoadingWeek(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, weekStart, weekEnd]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, WeekSession[]>();
    weekDays.forEach((d) => map.set(d.toDateString(), []));
    weekSessions.forEach((s) => {
      const key = new Date(s.scheduled_at).toDateString();
      if (map.has(key)) map.get(key)!.push(s);
    });
    return map;
  }, [weekDays, weekSessions]);

  const counts = weekDays.map(
    (d) => sessionsByDay.get(d.toDateString())?.length ?? 0,
  );
  const maxWeek = Math.max(1, ...counts);
  const totalWeek = counts.reduce((a, b) => a + b, 0);
  const selectedSessions =
    sessionsByDay.get(selectedDate.toDateString()) ?? [];
  const selectedLabel = format(selectedDate, "EEEE", { locale: ptBR });

  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = weekDays.findIndex((d) =>
      isSameDay(d, selectedDate),
    );
    let next = idx;
    if (e.key === "ArrowRight") next = Math.min(weekDays.length - 1, idx + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = weekDays.length - 1;
    else return;
    e.preventDefault();
    setSelectedDate(weekDays[next]);
    const btn = tabsRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )[next];
    btn?.focus();
  };

  const handleAction = (label: string) =>
    toast.success(label, { description: "Ação simulada nesta versão." });


  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* ─ Cabeçalho ─ */}
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-[28px] leading-tight font-semibold tracking-tight text-foreground">
              {greeting()}, {displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {capDate} · Próxima sessão às{" "}
              <span className="text-foreground font-medium">{nextTime}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full gap-2"
              onClick={() => handleAction("Buscar paciente")}
            >
              <Search className="h-4 w-4" />
              Buscar paciente
            </Button>
            <Button
              size="sm"
              className="h-10 rounded-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleAction("Nova sessão")}
            >
              <Plus className="h-4 w-4" />
              Nova sessão
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Notificações"
                  className="h-10 w-10 rounded-full"
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificações</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ─ KPIs ─ */}
        <section
          aria-label="Indicadores principais"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {KPI.map((k) => (
            <Link
              key={k.label}
              to={k.to}
              className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-none transition-colors hover:border-border">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <p className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                  {k.value}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{k.hint}</p>
              </Card>
            </Link>
          ))}
        </section>

        {/* ─ Hoje ─ */}
        <section aria-labelledby="today-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="today-heading"
              className="font-display text-xl font-semibold tracking-tight"
            >
              Hoje
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/app/agenda")}
              className="text-primary hover:text-primary hover:bg-primary/5 gap-1"
            >
              Ver agenda <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Card className="rounded-2xl border-border/60 divide-y divide-border/60 overflow-hidden">
            {TODAY.map((s) => (
              <TodayRow
                key={s.id}
                item={s}
                onOpen={() => handleAction(`Abrindo sessão de ${s.name}`)}
                onConfirm={() => handleAction(`Sessão de ${s.name} confirmada`)}
              />
            ))}
          </Card>
        </section>

        {/* ─ 2 colunas: Atenção + Agenda semana ─ */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Atenção */}
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Atenção necessária
            </h2>
            <Card className="rounded-2xl border-border/60 divide-y divide-border/60">
              {PENDINGS.map((p) => (
                <Link
                  key={p.label}
                  to={p.to}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:bg-muted/40"
                >
                  <span className="flex items-center gap-3 text-sm text-foreground">
                    <p.icon className="h-4 w-4 text-muted-foreground" />
                    {p.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium",
                      p.count > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.count}
                  </span>
                </Link>
              ))}
            </Card>
          </div>

          {/* Semana */}
          <div className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Agenda da semana
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {totalWeek} sessões distribuídas · {selectedLabel && `${selectedLabel.toLowerCase()}-feira selecionada`}
              </p>
            </div>
            <Card className="rounded-2xl border-border/60 p-5">
              <div className="flex items-end justify-between gap-3 h-44">
                {WEEK.map((d) => {
                  const active = d.key === selectedDay;
                  const pct = (d.value / maxWeek) * 100;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setSelectedDay(d.key)}
                      className="group flex flex-1 flex-col items-center gap-2 focus:outline-none"
                      aria-label={`${d.label}: ${d.value} sessões`}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {d.value}
                      </span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          style={{ height: `${pct}%` }}
                          className={cn(
                            "w-6 md:w-8 rounded-t-md transition-colors",
                            active
                              ? "bg-primary"
                              : "bg-primary/25 group-hover:bg-primary/40 group-focus-visible:bg-primary/40",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs",
                          active
                            ? "text-foreground font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {d.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>

        {/* ─ Financeiro compacto ─ */}
        <section aria-labelledby="finance-heading">
          <Card className="rounded-2xl border-border/60 bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="mt-1 font-display text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                    R$ 2.005
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A receber</p>
                  <p className="mt-1 font-display text-lg font-semibold text-foreground">
                    R$ 7.992
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Em atraso</p>
                  <p className="mt-1 font-display text-lg font-semibold text-amber-700 dark:text-amber-400">
                    2 pagamentos
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/app/financeiro")}
                className="rounded-full gap-2 self-start md:self-auto"
              >
                Abrir financeiro <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <h2 id="finance-heading" className="sr-only">
              Resumo financeiro
            </h2>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

/* ─── Sub-components ─── */
function TodayRow({
  item,
  onOpen,
  onConfirm,
}: {
  item: TodayItem;
  onOpen: () => void;
  onConfirm: () => void;
}) {
  const ModeIcon = item.mode === "Online" ? Video : MapPin;
  return (
    <div className="flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className="w-14 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
        {item.time}
      </div>
      <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {initials(item.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          Sessão {item.session}
          <span className="text-muted-foreground/50">·</span>
          <ModeIcon className="h-3 w-3" />
          {item.mode}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {item.status === "confirmed" ? (
          <Badge
            variant="secondary"
            className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            Confirmada
          </Badge>
        ) : item.status === "to-confirm" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="rounded-full h-8"
          >
            Confirmar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpen}
            className="rounded-full h-8"
          >
            Abrir sessão
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Mais ações para ${item.name}`}
              className="h-8 w-8 rounded-full hidden md:inline-flex"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mais ações</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
