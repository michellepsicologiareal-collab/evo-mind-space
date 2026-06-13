import { useEffect, useMemo, useState } from "react";
import {
  Moon, Utensils, Dumbbell, HeartPulse, Scale,
  Wind, Eye, Shield, Heart, Flower2, Users,
  Pause, Save, Calendar, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, Download, AlertTriangle,
  SmilePlus,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Constants ── */
const pleaseItems = [
  { key: "sleep", label: "Sono", icon: Moon },
  { key: "food", label: "Alimentação", icon: Utensils },
  { key: "movement", label: "Movimento", icon: Dumbbell },
  { key: "health", label: "Saúde", icon: HeartPulse },
  { key: "balance", label: "Equilíbrio", icon: Scale },
] as const;
type PleaseKey = (typeof pleaseItems)[number]["key"];

const moodEmojis = [
  { emoji: "🤩", label: "Ótimo" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😔", label: "Baixo" },
  { emoji: "😫", label: "Esgotado" },
];

const triggerOptions = [
  "Impotência",
  "Raiva",
  "Gatilho Pessoal",
  "Ansiedade",
  "Identificação",
  "Tristeza",
  "História pessoal",
  "Outro",
];

const regulationCards = [
  {
    key: "tip", title: "TIP — Regular o corpo", subtitle: "Regulação fisiológica",
    icon: HeartPulse, color: "bg-sage/20 text-sage",
    intro: "Mude a fisiologia primeiro. Quando o estresse domina, o corpo precisa do sinal de que é seguro parar.",
    steps: [
      "Mergulhe o rosto em água fria por 15–30 segundos ou segure gelo nas mãos.",
      "Faça uma atividade física intensa por 1–2 minutos (subir escada, 10 agachamentos).",
      "Respire devagar: expire mais longo que inspire. Ex: 4 dentro, 6 fora.",
      "Relaxamento muscular progressivo: tensione e solte grupos musculares por 10 segundos cada.",
    ],
  },
  {
    key: "mindfulness", title: "Mindfulness", subtitle: "Âncora no presente (1 minuto)",
    icon: Eye, color: "bg-serene/20 text-serene",
    intro: "Um minuto de presença pode mudar todo o resto do dia.",
    steps: ["Sente-se com os pés no chão.", "Observe 3 sons ao seu redor.", "Respire profundamente. Inspire... Expire...", "Você está presente."],
  },
  {
    key: "limits", title: "Verificação de limites", subtitle: "Papel profissional",
    icon: Shield, color: "bg-sage/20 text-sage",
    intro: "Três perguntas rápidas. Responda honestamente.",
    steps: [
      "Estou fazendo algo que é responsabilidade do paciente, não minha?",
      "Estou pensando nesse caso fora das sessões com frequência?",
      "Sinto que preciso que esse paciente melhore para me sentir bem?",
    ],
    footer: 'Se "sim" para 2 ou mais: é hora de supervisão ou de revisar o enquadramento clínico.',
  },
  {
    key: "acceptance", title: "Aceitação radical", subtitle: "Para casos que pesam",
    icon: Heart, color: "bg-serene/20 text-serene",
    intro: "Para casos que pesam muito.",
    steps: [
      'Reconheça: "Isso que sinto é real. Faz sentido sentir assim."',
      "Identifique o que está dentro do seu controle como terapeuta.",
      "Identifique o que não é seu mudar — e afirme isso em voz alta se precisar.",
    ],
    footer: "Lembrete: aceitar não é concordar. É parar de lutar contra o que não pode mudar agora.",
  },
  {
    key: "breathing", title: "Box breathing — 4-4-4-4", subtitle: "Reequilíbrio em 2 minutos",
    icon: Wind, color: "bg-sage/20 text-sage",
    intro: "Dois minutos reequilibram o sistema nervoso autônomo.",
    steps: [
      "Inspire pelo nariz contando até 4.", "Segure o ar contando até 4.",
      "Expire pela boca contando até 4.", "Segure vazio contando até 4.",
    ],
    footer: "Repita 4 a 6 vezes. Olhos fechados se possível.",
  },
  {
    key: "supervision", title: "Supervisão", subtitle: "Solicitar suporte clínico",
    icon: Users, color: "bg-serene/20 text-serene",
    intro: "Quando sentir que está carregando demais, pedir ajuda é um ato de competência.",
    steps: [
      "Identifique o caso ou situação que está pesando.",
      "Procure seu supervisor ou colega de confiança.",
      "Compartilhe sem julgamento — o espaço é seguro.",
    ],
  },
];

/* ── Types ── */
interface CheckinRow {
  id: string;
  checked_at: string;
  stress_level: number;
  sleep: boolean | null;
  food: boolean | null;
  movement: boolean | null;
  health: boolean | null;
  balance: boolean | null;
  sessions_count: number;
  pauses_count: number;
}

interface TriggerRow {
  id: string;
  checked_at: string;
  mood_emoji: string;
  triggers: string[];
  reflective_note: string;
  patient_id: string | null;
}

interface PatientOption {
  id: string;
  full_name: string;
}

interface DaySession {
  id: string;
  patient_id: string;
  patient_name: string;
  scheduled_at: string;
  status: string;
}

/* ── Component ── */
const Autocuidado = () => {
  const { user } = useAuth();

  // PLEASE check-in state
  const [pleaseState, setPleaseState] = useState<Record<PleaseKey, boolean | null>>({
    sleep: null, food: null, movement: null, health: null, balance: null,
  });
  const [stress, setStress] = useState(3);
  const [sessionCount, setSessionCount] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [todayId, setTodayId] = useState<string | null>(null);

  // Mood / trigger state
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodDate, setMoodDate] = useState<Date>(new Date());
  const [moodEmoji, setMoodEmoji] = useState("😐");
  const [hadTriggerSession, setHadTriggerSession] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [reflectiveNote, setReflectiveNote] = useState("");
  const [triggerPatientId, setTriggerPatientId] = useState<string | null>(null);
  const [savingTrigger, setSavingTrigger] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [loadingDaySessions, setLoadingDaySessions] = useState(false);

  // History
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [history, setHistory] = useState<CheckinRow[]>([]);
  const [triggerHistory, setTriggerHistory] = useState<TriggerRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load patients for dropdown
  useEffect(() => {
    if (!user) return;
    supabase
      .from("patients")
      .select("id, full_name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setPatients((data as PatientOption[]) ?? []));
  }, [user]);

  // Load sessions for the selected mood date (to pick which one triggered)
  useEffect(() => {
    if (!user || !moodOpen) return;
    setLoadingDaySessions(true);
    const dayStart = new Date(moodDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(moodDate);
    dayEnd.setHours(23, 59, 59, 999);

    supabase
      .from("sessions")
      .select("id, patient_id, scheduled_at, status, patients!inner(full_name)")
      .eq("user_id", user.id)
      .eq("is_expense", false)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => {
        const mapped: DaySession[] = ((data as any[]) ?? []).map((s) => ({
          id: s.id,
          patient_id: s.patient_id,
          patient_name: s.patients?.full_name ?? "Paciente",
          scheduled_at: s.scheduled_at,
          status: s.status,
        }));
        setDaySessions(mapped);
        setLoadingDaySessions(false);
      });
  }, [user, moodDate, moodOpen]);

  // Load today's check-in
  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("selfcare_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("checked_at", today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTodayId(data.id);
          setStress(data.stress_level);
          setPleaseState({
            sleep: data.sleep, food: data.food, movement: data.movement,
            health: data.health, balance: data.balance,
          });
          setSessionCount(data.sessions_count);
          setPauseCount(data.pauses_count);
        }
      });
  }, [user]);

  // Load history for selected month
  useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    const start = format(startOfMonth(monthCursor), "yyyy-MM-dd");
    const end = format(endOfMonth(monthCursor), "yyyy-MM-dd");

    Promise.all([
      supabase.from("selfcare_checkins").select("*")
        .eq("user_id", user.id).gte("checked_at", start).lte("checked_at", end)
        .order("checked_at", { ascending: true }),
      (supabase as any).from("therapist_triggers").select("*")
        .eq("user_id", user.id).gte("checked_at", start).lte("checked_at", end)
        .order("checked_at", { ascending: true }),
    ]).then(([checkins, triggers]) => {
      setHistory((checkins.data as CheckinRow[] | null) ?? []);
      setTriggerHistory((triggers.data as TriggerRow[] | null) ?? []);
      setHistoryLoading(false);
    });
  }, [user, monthCursor]);

  /* ── Derived data ── */
  const chartData = useMemo(() =>
    history.map((h) => ({
      day: format(new Date(h.checked_at + "T12:00:00"), "dd"),
      estresse: h.stress_level,
      atendimentos: h.sessions_count,
    })), [history]);

  const moodChartData = useMemo(() => {
    const emojiToScore: Record<string, number> = { "🤩": 5, "🙂": 4, "😐": 3, "😔": 2, "😫": 1 };
    return triggerHistory.map((t) => ({
      day: format(new Date(t.checked_at + "T12:00:00"), "dd"),
      humor: emojiToScore[t.mood_emoji] ?? 3,
      emoji: t.mood_emoji,
    }));
  }, [triggerHistory]);

  const triggerFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    triggerHistory.forEach((t) => t.triggers.forEach((tr) => {
      counts[tr] = (counts[tr] || 0) + 1;
    }));
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [triggerHistory]);

  const patientTriggerFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    triggerHistory.forEach((t) => {
      if (t.patient_id) {
        const patient = patients.find((p) => p.id === t.patient_id);
        const name = patient?.full_name ?? "Paciente";
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [triggerHistory, patients]);

  const avgStress = useMemo(() => {
    if (history.length === 0) return null;
    return (history.reduce((s, h) => s + h.stress_level, 0) / history.length).toFixed(1);
  }, [history]);

  /* ── Handlers ── */
  const saveCheckin = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      checked_at: format(new Date(), "yyyy-MM-dd"),
      stress_level: stress,
      sleep: pleaseState.sleep, food: pleaseState.food, movement: pleaseState.movement,
      health: pleaseState.health, balance: pleaseState.balance,
      sessions_count: sessionCount, pauses_count: pauseCount,
    };
    let error;
    if (todayId) {
      const res = await supabase.from("selfcare_checkins").update(payload).eq("id", todayId);
      error = res.error;
    } else {
      const res = await supabase.from("selfcare_checkins").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setTodayId(res.data.id);
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar check-in."); return; }
    toast.success("Check-in salvo! 💜");
    refreshHistory();
  };

  const saveTriggerCheckin = async () => {
    if (!user) return;
    setSavingTrigger(true);
    const payload = {
      user_id: user.id,
      checked_at: format(moodDate, "yyyy-MM-dd"),
      mood_emoji: moodEmoji,
      triggers: hadTriggerSession ? selectedTriggers : [],
      reflective_note: reflectiveNote,
      patient_id: hadTriggerSession ? triggerPatientId : null,
    };
    const { error } = await (supabase as any).from("therapist_triggers").insert(payload);
    setSavingTrigger(false);
    if (error) { toast.error("Erro ao salvar registro emocional."); return; }
    toast.success("Registro emocional salvo! 🌿");
    setMoodOpen(false);
    setSelectedTriggers([]);
    setReflectiveNote("");
    setTriggerPatientId(null);
    setHadTriggerSession(false);
    setMoodEmoji("😐");
    setMoodDate(new Date());
    refreshHistory();
  };

  const refreshHistory = async () => {
    if (!user) return;
    const start = format(startOfMonth(monthCursor), "yyyy-MM-dd");
    const end = format(endOfMonth(monthCursor), "yyyy-MM-dd");
    const [c, t] = await Promise.all([
      supabase.from("selfcare_checkins").select("*").eq("user_id", user.id)
        .gte("checked_at", start).lte("checked_at", end).order("checked_at", { ascending: true }),
      (supabase as any).from("therapist_triggers").select("*").eq("user_id", user.id)
        .gte("checked_at", start).lte("checked_at", end).order("checked_at", { ascending: true }),
    ]);
    setHistory((c.data as CheckinRow[] | null) ?? []);
    setTriggerHistory((t.data as TriggerRow[] | null) ?? []);
  };

  const togglePlease = (key: PleaseKey, value: boolean) => {
    setPleaseState((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  const toggleTrigger = (t: string) => {
    setSelectedTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const exportEmotionalReport = () => {
    const lines = [
      "RELATÓRIO EMOCIONAL DO TERAPEUTA",
      `Período: ${format(startOfMonth(monthCursor), "dd/MM/yyyy")} a ${format(endOfMonth(monthCursor), "dd/MM/yyyy")}`,
      "",
      "── CHECK-INS DE HUMOR ──",
      ...triggerHistory.map((t) =>
        `${format(new Date(t.checked_at + "T12:00:00"), "dd/MM/yyyy")} | ${t.mood_emoji} | Gatilhos: ${t.triggers.join(", ") || "Nenhum"} | Nota: ${t.reflective_note || "—"}`
      ),
      "",
      "── FREQUÊNCIA DE GATILHOS ──",
      ...triggerFrequency.map((f) => `${f.name}: ${f.count}x`),
      "",
      "── PACIENTES QUE MAIS ATIVARAM ──",
      ...patientTriggerFrequency.map((f) => `${f.name}: ${f.count}x`),
      "",
      "── CHECK-INS DE AUTOCUIDADO ──",
      ...history.map((h) =>
        `${format(new Date(h.checked_at + "T12:00:00"), "dd/MM/yyyy")} | Estresse: ${h.stress_level}/10 | Atendimentos: ${h.sessions_count} | Pausas: ${h.pauses_count}`
      ),
      "",
      `Estresse médio: ${avgStress ?? "—"}/10`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clima-emocional-${format(monthCursor, "yyyy-MM")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado! 📄");
  };

  const stressLabel =
    stress <= 4 ? "Nível de estresse confortável."
      : stress <= 7 ? "Atenção ao estresse. Considere uma pausa."
      : "Atenção: Nível de estresse elevado. Considere uma pausa ou supervisão.";
  const stressColor = stress <= 4 ? "text-sage" : stress <= 7 ? "text-amber-600" : "text-destructive";

  const activeCard = regulationCards.find((c) => c.key === openCard);

  const sageShades = ["#3D5C35", "#4A6B40", "#5A7D4E", "#6B8E5A", "#7DA068", "#8FB278", "#A0C488"];

  return (
    <div className="space-y-8 animate-fade-up">
      {/* ── Header ── */}
      <header className="rounded-2xl border border-serene/20 bg-gradient-to-br from-sage/5 via-card to-serene/5 shadow-card p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sage via-serene to-transparent" />
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
          Espaço de Autocuidado
        </h1>
        <p className="mt-2 text-muted-foreground">Check-in diário · Protocolo PLEASE · Monitoramento emocional</p>
        <p className="mt-4 text-lg text-foreground/80 font-medium">Como você está hoje?</p>
      </header>

      {/* ── Big "Registrar Meu Humor" Button ── */}
      <section className="flex justify-center">
        <Button
          variant="accent"
          size="lg"
          onClick={() => { setMoodOpen(true); setMoodDate(new Date()); }}
          className="gap-3 text-lg px-10 py-7 rounded-2xl shadow-elegant hover:scale-[1.02] transition-all"
        >
          <SmilePlus className="h-6 w-6" />
          Registrar Meu Humor Agora
        </Button>
      </section>

      {/* ── Mood Registration Dialog ── */}
      <Dialog open={moodOpen} onOpenChange={setMoodOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <SmilePlus className="h-6 w-6 text-sage" />
              Registrar Humor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Date picker */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Data do registro</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 text-left">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(moodDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={moodDate}
                    onSelect={(d) => d && setMoodDate(d)}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Mood selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Como você está se sentindo?</label>
              <div className="flex justify-center gap-3 sm:gap-4">
                {moodEmojis.map((m) => (
                  <button
                    key={m.emoji}
                    onClick={() => setMoodEmoji(m.emoji)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all border-2",
                      moodEmoji === m.emoji
                        ? "border-sage bg-sage/10 scale-110 shadow-soft"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="text-3xl">{m.emoji}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger session question */}
            <div className="border-t border-border pt-5">
              <label className="text-sm font-medium text-foreground mb-3 block flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Teve alguma sessão que te ativou hoje?
              </label>
              <div className="flex gap-3">
                <Button
                  variant={hadTriggerSession ? "accent" : "outline"}
                  size="sm"
                  onClick={() => setHadTriggerSession(true)}
                >
                  Sim
                </Button>
                <Button
                  variant={!hadTriggerSession ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setHadTriggerSession(false); setSelectedTriggers([]); setTriggerPatientId(null); }}
                  className={!hadTriggerSession ? "bg-sage text-white hover:bg-sage/90" : ""}
                >
                  Não
                </Button>
              </div>
            </div>

            {/* Conditional trigger details */}
            {hadTriggerSession && (
              <div className="space-y-4 pl-2 border-l-2 border-sage/30 ml-1">
                {/* Day sessions picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Sessões deste dia
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {loadingDaySessions
                        ? "carregando..."
                        : `${daySessions.length} ${daySessions.length === 1 ? "sessão" : "sessões"}`}
                    </span>
                  </div>

                  {!loadingDaySessions && daySessions.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {daySessions.map((s) => {
                        const selected = triggerPatientId === s.patient_id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setTriggerPatientId(selected ? null : s.patient_id)}
                            className={cn(
                              "w-full flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                              selected
                                ? "border-sage bg-sage/10 shadow-soft"
                                : "border-border bg-background hover:border-sage/40 hover:bg-sage/5"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {s.patient_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(s.scheduled_at), "HH:mm")} · {s.status}
                              </p>
                            </div>
                            {selected && (
                              <span className="text-xs font-semibold text-sage shrink-0">
                                ✓ Ativou
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : !loadingDaySessions ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground italic">
                        Sem sessões registradas neste dia. Selecione um paciente manualmente:
                      </p>
                      <select
                        value={triggerPatientId ?? ""}
                        onChange={(e) => setTriggerPatientId(e.target.value || null)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sage/40"
                      >
                        <option value="">Selecionar paciente...</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                {/* Trigger chips */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">O que sentiu?</label>
                  <div className="flex flex-wrap gap-2">
                    {triggerOptions.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTrigger(t)}
                        className={cn(
                          "rounded-full px-4 py-1.5 text-sm font-medium transition-all border",
                          selectedTriggers.includes(t)
                            ? "bg-accent text-accent-foreground border-accent shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-accent/50"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reflective note */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nota reflexiva (opcional)</label>
              <Textarea
                value={reflectiveNote}
                onChange={(e) => setReflectiveNote(e.target.value)}
                placeholder="O que você observou sobre si durante a sessão?"
                className="resize-none min-h-[80px]"
                maxLength={500}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMoodOpen(false)}>Cancelar</Button>
              <Button
                variant="accent"
                onClick={saveTriggerCheckin}
                disabled={savingTrigger}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar registro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Emotional Climate Charts ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">📊 Clima Emocional</h2>
            <p className="text-sm text-muted-foreground">Seus padrões de humor e gatilhos ao longo do mês.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-full p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2 capitalize min-w-[120px] text-center">
                {format(monthCursor, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportEmotionalReport}
              disabled={history.length === 0 && triggerHistory.length === 0}
              className="gap-1.5 border-sage/30 text-sage hover:bg-sage/10"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats */}
        {(history.length > 0 || triggerHistory.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-sage/5 border border-sage/15 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{history.length}</p>
              <p className="text-xs text-muted-foreground">Check-ins</p>
            </div>
            <div className="rounded-xl bg-sage/5 border border-sage/15 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{avgStress ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Estresse médio</p>
            </div>
            <div className="rounded-xl bg-sage/5 border border-sage/15 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {history.reduce((s, h) => s + h.sessions_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Atendimentos</p>
            </div>
            <div className="rounded-xl bg-sage/5 border border-sage/15 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{triggerHistory.length}</p>
              <p className="text-xs text-muted-foreground">Registros emocionais</p>
            </div>
          </div>
        )}

        {/* Two-column chart layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Mood line chart */}
          <div className="rounded-2xl border border-sage/15 bg-sage/5 p-5">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sage" />
              Variação do Humor
            </h3>
            {moodChartData.length >= 2 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={moodChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => ["", "😫", "😔", "😐", "🙂", "🤩"][v] || ""} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                      formatter={(value: number) => [["", "😫", "😔", "😐", "🙂", "🤩"][value] || value, "Humor"]}
                    />
                    <Line type="monotone" dataKey="humor" stroke="#3D5C35" strokeWidth={2.5} dot={{ r: 5, fill: "#3D5C35" }} name="Humor" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                Registre ao menos 2 dias de humor para ver o gráfico. 🌿
              </p>
            )}
          </div>

          {/* Patient / trigger bar chart */}
          <div className="rounded-2xl border border-sage/15 bg-sage/5 p-5">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-sage" />
              Pacientes que mais ativaram
            </h3>
            {patientTriggerFrequency.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patientTriggerFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                      formatter={(value: number) => [`${value}x`, "Ativações"]}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                      {patientTriggerFrequency.map((_, i) => (
                        <Cell key={i} fill={sageShades[i % sageShades.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                Associe pacientes aos registros para ver o gráfico. 🌱
              </p>
            )}
          </div>
        </div>

        {/* Trigger frequency bar chart */}
        {triggerFrequency.length > 0 && (
          <div className="rounded-2xl border border-sage/15 bg-sage/5 p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Gatilhos mais frequentes</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={triggerFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={110} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                    formatter={(value: number) => [`${value}x`, "Ocorrências"]}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                    {triggerFrequency.map((_, i) => (
                      <Cell key={i} fill={sageShades[i % sageShades.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Stress line chart */}
        {chartData.length >= 2 && (
          <div className="rounded-2xl border border-sage/15 bg-sage/5 p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Estresse & Atendimentos</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }} />
                  <Line type="monotone" dataKey="estresse" stroke="#A57164" strokeWidth={2} dot={{ r: 4 }} name="Estresse" />
                  <Line type="monotone" dataKey="atendimentos" stroke="#3D5C35" strokeWidth={2} dot={{ r: 4 }} name="Atendimentos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Empty state */}
        {historyLoading ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : history.length === 0 && triggerHistory.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            Nenhum registro neste mês. Comece registrando como você está hoje! 💜
          </p>
        ) : null}
      </section>

      {/* ── PLEASE Check-in ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-5">Check-in Biológico (PLEASE)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {pleaseItems.map((item) => {
            const val = pleaseState[item.key];
            return (
              <div key={item.key} className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/10">
                  <item.icon className="h-6 w-6 text-sage" />
                </div>
                <span className="text-xs font-medium text-foreground">{item.label}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePlease(item.key, true)}
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                      val === true ? "bg-sage text-white border-sage" : "border-border text-muted-foreground hover:border-sage/50"
                    )}
                  >✓</button>
                  <button
                    onClick={() => togglePlease(item.key, false)}
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                      val === false ? "bg-destructive/80 text-white border-destructive/80" : "border-border text-muted-foreground hover:border-destructive/30"
                    )}
                  >✗</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Stress Scale ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Escala de Estresse</h2>
        <p className="text-sm text-muted-foreground mb-6">Deslize para indicar seu nível atual.</p>
        <div className="px-2">
          <Slider
            value={[stress]}
            onValueChange={(v) => setStress(v[0])}
            min={0} max={10} step={1}
            className="[&_[role=slider]]:bg-sage [&_[role=slider]]:border-sage [&_[data-orientation=horizontal]>span:first-child>span]:bg-sage"
          />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-display text-4xl font-bold text-foreground">{stress}</span>
          <p className={cn("text-sm font-medium", stressColor)}>{stressLabel}</p>
        </div>
      </section>

      {/* ── Session counter ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Monitor de Atendimentos</h2>
        <p className="text-sm text-muted-foreground mb-5">Marque quantos atendimentos realizou hoje.</p>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSessionCount(Math.max(0, sessionCount - 1))}>
            <span className="text-lg font-bold">−</span>
          </Button>
          <span className="font-display text-4xl font-bold text-foreground min-w-[3ch] text-center">{sessionCount}</span>
          <Button variant="outline" size="icon" onClick={() => setSessionCount(sessionCount + 1)}>
            <span className="text-lg font-bold">+</span>
          </Button>
          <span className="text-sm text-muted-foreground">atendimentos</span>
        </div>
        <div className="flex items-center gap-4 mt-5">
          <Button variant="outline" size="sm" className="min-h-[44px] border-sage/30 text-sage hover:bg-sage/10"
            onClick={() => setPauseCount((p) => p + 1)}>
            <Pause className="h-4 w-4" /> Registrar pausa
          </Button>
          {pauseCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {pauseCount} {pauseCount === 1 ? "pausa" : "pausas"} hoje
            </span>
          )}
        </div>
      </section>

      {/* ── Save check-in ── */}
      <div className="flex justify-end">
        <Button variant="accent" size="lg" onClick={saveCheckin} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {todayId ? "Atualizar check-in" : "Salvar check-in"}
        </Button>
      </div>

      {/* ── Regulation Skills ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Habilidades de Regulação</h2>
        <p className="text-sm text-muted-foreground mb-5">Ferramentas para descompressão clínica.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regulationCards.map((card) => (
            <button
              key={card.key}
              onClick={() => setOpenCard(card.key)}
              className="rounded-2xl border border-border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft group"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl mb-3", card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-foreground group-hover:text-sage transition-colors">{card.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Regulation detail modal ── */}
      <Dialog open={!!openCard} onOpenChange={(v) => !v && setOpenCard(null)}>
        <DialogContent className="max-w-md">
          {activeCard && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl flex items-center gap-2">
                  <activeCard.icon className={cn("h-6 w-6", activeCard.color.split(" ")[1])} />
                  {activeCard.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-foreground/80">{activeCard.intro}</p>
                <ol className="space-y-3">
                  {activeCard.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage font-bold text-xs">{i + 1}</div>
                      <p className="text-foreground/80 text-sm leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
                {activeCard.footer && (
                  <p className="text-sm text-muted-foreground italic border-t border-border pt-3">{activeCard.footer}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="border-sage/30 text-sage hover:bg-sage/10" onClick={() => setOpenCard(null)}>Concluir</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── History cards ── */}
      {!historyLoading && (history.length > 0 || triggerHistory.length > 0) && (
        <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Histórico do Mês</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...history].reverse().map((h) => {
              const pleaseOk = [h.sleep, h.food, h.movement, h.health, h.balance].filter(Boolean).length;
              const pleaseTotal = [h.sleep, h.food, h.movement, h.health, h.balance].filter((v) => v !== null).length;
              return (
                <div
                  key={h.id}
                  className={cn(
                    "rounded-2xl border p-4 space-y-2",
                    h.stress_level >= 8 ? "border-destructive/30 bg-destructive/5" :
                    h.stress_level >= 5 ? "border-amber-300/30 bg-amber-50/30" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(h.checked_at + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    {h.stress_level >= 7 ? <TrendingUp className="h-4 w-4 text-destructive" /> :
                     h.stress_level <= 3 ? <TrendingDown className="h-4 w-4 text-sage" /> : null}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={cn("font-bold text-lg",
                      h.stress_level >= 7 ? "text-destructive" : h.stress_level >= 5 ? "text-amber-600" : "text-sage"
                    )}>{h.stress_level}/10</span>
                    <span className="text-muted-foreground">estresse</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{h.sessions_count} atendimentos</span>
                    <span>·</span>
                    <span>{h.pauses_count} pausas</span>
                    {pleaseTotal > 0 && (<><span>·</span><span>PLEASE {pleaseOk}/{pleaseTotal}</span></>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default Autocuidado;
