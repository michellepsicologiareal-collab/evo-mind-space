import { useEffect, useMemo, useState } from "react";
import {
  Moon, Utensils, Dumbbell, HeartPulse, Scale,
  Wind, Eye, Shield, Heart, Flower2, Users,
  Pause, Save, Calendar, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, Download, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

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
  "História pessoal",
  "Impotência",
  "Raiva",
  "Ansiedade",
  "Identificação",
  "Tristeza",
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
  const [moodEmoji, setMoodEmoji] = useState("😐");
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [reflectiveNote, setReflectiveNote] = useState("");
  const [triggerPatientId, setTriggerPatientId] = useState<string | null>(null);
  const [savingTrigger, setSavingTrigger] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);

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
      checked_at: format(new Date(), "yyyy-MM-dd"),
      mood_emoji: moodEmoji,
      triggers: selectedTriggers,
      reflective_note: reflectiveNote,
      patient_id: triggerPatientId,
    };
    const { error } = await (supabase as any).from("therapist_triggers").insert(payload);
    setSavingTrigger(false);
    if (error) { toast.error("Erro ao salvar registro emocional."); return; }
    toast.success("Registro emocional salvo! 🌿");
    setSelectedTriggers([]);
    setReflectiveNote("");
    setTriggerPatientId(null);
    refreshHistory();
  };

  const refreshHistory = async () => {
    if (!user) return;
    const now = new Date();
    if (monthCursor.getMonth() !== now.getMonth() || monthCursor.getFullYear() !== now.getFullYear()) return;
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

  const barColors = ["#3D5C35", "#A57164", "#9B8DB8", "#D4A853", "#6B8E5A", "#B07D6A", "#7B6FA0"];

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

      {/* ── Mood Emoji Check-in ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Check-in Emocional</h2>
        <p className="text-sm text-muted-foreground mb-5">Como está seu humor geral agora?</p>
        <div className="flex justify-center gap-3 sm:gap-5 mb-6">
          {moodEmojis.map((m) => (
            <button
              key={m.emoji}
              onClick={() => setMoodEmoji(m.emoji)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl p-3 sm:p-4 transition-all border-2",
                moodEmoji === m.emoji
                  ? "border-sage bg-sage/10 scale-110 shadow-soft"
                  : "border-transparent hover:border-border hover:bg-muted/50"
              )}
            >
              <span className="text-3xl sm:text-4xl">{m.emoji}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Trigger form */}
        <div className="border-t border-border pt-6 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-foreground mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Sessões que me ativaram
            </h3>
            <p className="text-xs text-muted-foreground mb-3">O que "pegou" em você hoje?</p>
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

          {/* Patient dropdown */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Paciente relacionado (opcional)</label>
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

          {/* Reflective note */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Nota reflexiva</label>
            <Textarea
              value={reflectiveNote}
              onChange={(e) => setReflectiveNote(e.target.value)}
              placeholder="O que você observou sobre si durante a sessão?"
              className="resize-none min-h-[80px]"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="accent"
              onClick={saveTriggerCheckin}
              disabled={savingTrigger}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar registro emocional
            </Button>
          </div>
        </div>
      </section>

      {/* ── PLEASE Check-in ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-5">Check-in Biológico</h2>
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

      {/* ── Dashboard: Emotional Charts ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Painel Emocional</h2>
            <p className="text-sm text-muted-foreground">Visualize seus padrões de humor e gatilhos ao longo do mês.</p>
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
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{history.length}</p>
              <p className="text-xs text-muted-foreground">Check-ins</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{avgStress ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Estresse médio</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {history.reduce((s, h) => s + h.sessions_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Atendimentos</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{triggerHistory.length}</p>
              <p className="text-xs text-muted-foreground">Registros emocionais</p>
            </div>
          </div>
        )}

        {/* Mood line chart */}
        {moodChartData.length >= 2 && (
          <div>
            <h3 className="font-display font-semibold text-foreground mb-3">Variação do Humor</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => ["", "😫", "😔", "😐", "🙂", "🤩"][v] || ""} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                    formatter={(value: number) => [["", "😫", "😔", "😐", "🙂", "🤩"][value] || value, "Humor"]}
                  />
                  <Line type="monotone" dataKey="humor" stroke="#3D5C35" strokeWidth={2.5} dot={{ r: 5, fill: "#3D5C35" }} name="Humor" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Stress line chart */}
        {chartData.length >= 2 && (
          <div>
            <h3 className="font-display font-semibold text-foreground mb-3">Estresse & Atendimentos</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }} />
                  <Line type="monotone" dataKey="estresse" stroke="#A57164" strokeWidth={2} dot={{ r: 4 }} name="Estresse" />
                  <Line type="monotone" dataKey="atendimentos" stroke="#3D5C35" strokeWidth={2} dot={{ r: 4 }} name="Atendimentos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Trigger frequency bar chart */}
        {triggerFrequency.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-foreground mb-3">Gatilhos mais frequentes</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={triggerFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={110} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                    formatter={(value: number) => [`${value}x`, "Ocorrências"]} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                    {triggerFrequency.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* History cards */}
        {historyLoading ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : history.length === 0 && triggerHistory.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            Nenhum registro neste mês. Comece registrando como você está hoje! 💜
          </p>
        ) : (
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
        )}
      </section>
    </div>
  );
};

export default Autocuidado;
