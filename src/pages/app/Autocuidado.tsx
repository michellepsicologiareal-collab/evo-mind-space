import { useState } from "react";
import {
  Moon, Utensils, Dumbbell, HeartPulse, Scale,
  Wind, Eye, Shield, Heart, Flower2, Users,
  Pause, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ── PLEASE check-in items ── */
const pleaseItems = [
  { key: "sleep", label: "Sono", icon: Moon },
  { key: "food", label: "Alimentação", icon: Utensils },
  { key: "movement", label: "Movimento", icon: Dumbbell },
  { key: "health", label: "Saúde", icon: HeartPulse },
  { key: "balance", label: "Equilíbrio", icon: Scale },
] as const;

type PleaseKey = (typeof pleaseItems)[number]["key"];

/* ── Regulation cards ── */
const regulationCards = [
  {
    key: "tip",
    title: "TIP",
    description: "Regulação fisiológica.",
    icon: HeartPulse,
    color: "bg-sage/20 text-sage",
  },
  {
    key: "mindfulness",
    title: "Mindfulness",
    description: "Âncora no presente (1 minuto).",
    icon: Eye,
    color: "bg-serene/20 text-serene",
    action: "mindfulness",
  },
  {
    key: "limits",
    title: "Limites",
    description: "Verificação do papel profissional.",
    icon: Shield,
    color: "bg-sage/20 text-sage",
  },
  {
    key: "acceptance",
    title: "Aceitação",
    description: "Aceitação radical para casos complexos.",
    icon: Heart,
    color: "bg-serene/20 text-serene",
  },
  {
    key: "breathing",
    title: "Respiração",
    description: "Técnica Box Breathing (4-4-4-4).",
    icon: Wind,
    color: "bg-sage/20 text-sage",
  },
  {
    key: "supervision",
    title: "Supervisão",
    description: "Solicitar suporte clínico.",
    icon: Users,
    color: "bg-serene/20 text-serene",
  },
];

const Autocuidado = () => {
  const [pleaseState, setPleaseState] = useState<Record<PleaseKey, boolean | null>>({
    sleep: null, food: null, movement: null, health: null, balance: null,
  });
  const [stress, setStress] = useState(3);
  const [sessions, setSessions] = useState<Set<number>>(new Set());
  const [pauseCount, setPauseCount] = useState(0);
  const [mindfulnessOpen, setMindfulnessOpen] = useState(false);

  const togglePlease = (key: PleaseKey, value: boolean) => {
    setPleaseState((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  const toggleSession = (n: number) => {
    setSessions((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const stressLabel =
    stress <= 4
      ? "Nível de estresse confortável."
      : stress <= 7
      ? "Atenção ao estresse. Considere uma pausa."
      : "Atenção: Nível de estresse elevado. Considere uma pausa ou supervisão.";

  const stressColor =
    stress <= 4 ? "text-sage" : stress <= 7 ? "text-amber-600" : "text-destructive";

  return (
    <div className="space-y-8 animate-fade-up">
      {/* ── Header ── */}
      <header className="rounded-2xl border border-serene/20 bg-gradient-to-br from-sage/5 via-card to-serene/5 shadow-card p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sage via-serene to-transparent" />
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
          Espaço de Autocuidado
        </h1>
        <p className="mt-2 text-muted-foreground">Check-in diário · Protocolo PLEASE</p>
        <p className="mt-4 text-lg text-foreground/80 font-medium">Como você está hoje?</p>
      </header>

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
                      val === true
                        ? "bg-sage text-white border-sage"
                        : "border-border text-muted-foreground hover:border-sage/50"
                    )}
                    aria-label={`${item.label} sim`}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => togglePlease(item.key, false)}
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                      val === false
                        ? "bg-destructive/80 text-white border-destructive/80"
                        : "border-border text-muted-foreground hover:border-destructive/30"
                    )}
                    aria-label={`${item.label} não`}
                  >
                    ✗
                  </button>
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
            min={0}
            max={10}
            step={1}
            className="[&_[role=slider]]:bg-sage [&_[role=slider]]:border-sage [&_[data-orientation=horizontal]>span:first-child>span]:bg-sage"
          />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>0</span>
            <span>5</span>
            <span>10</span>
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
        <p className="text-sm text-muted-foreground mb-5">Marque os atendimentos realizados hoje.</p>

        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => toggleSession(n)}
              className={cn(
                "h-12 w-12 rounded-xl font-bold text-sm transition-all border-2",
                sessions.has(n)
                  ? "bg-serene text-white border-serene shadow-md"
                  : "border-border text-muted-foreground hover:border-serene/50"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-5">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] border-sage/30 text-sage hover:bg-sage/10"
            onClick={() => setPauseCount((p) => p + 1)}
          >
            <Pause className="h-4 w-4" /> Registrar pausa
          </Button>
          {pauseCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {pauseCount} {pauseCount === 1 ? "pausa" : "pausas"} hoje
            </span>
          )}
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{sessions.size}</span> de 8 atendimentos realizados
        </p>
      </section>

      {/* ── Regulation Skills ── */}
      <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Habilidades de Regulação</h2>
        <p className="text-sm text-muted-foreground mb-5">Ferramentas para descompressão clínica.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regulationCards.map((card) => (
            <button
              key={card.key}
              onClick={() => card.action === "mindfulness" && setMindfulnessOpen(true)}
              className="rounded-2xl border border-border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft group"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl mb-3", card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-foreground group-hover:text-sage transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Mindfulness Modal ── */}
      <Dialog open={mindfulnessOpen} onOpenChange={setMindfulnessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Flower2 className="h-6 w-6 text-serene" /> Mindfulness — 1 minuto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <MindfulStep step={1} text="Sente-se com os pés no chão." />
            <MindfulStep step={2} text="Observe 3 sons ao seu redor." />
            <MindfulStep step={3} text="Respire profundamente. Inspire... Expire..." />
            <MindfulStep step={4} text="Você está presente." />
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-serene/30 text-serene hover:bg-serene/10"
              onClick={() => setMindfulnessOpen(false)}
            >
              Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MindfulStep = ({ step, text }: { step: number; text: string }) => (
  <div className="flex items-start gap-4">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-serene/15 text-serene font-bold text-sm">
      {step}
    </div>
    <p className="text-foreground/80 text-base leading-relaxed pt-1">{text}</p>
  </div>
);

export default Autocuidado;
