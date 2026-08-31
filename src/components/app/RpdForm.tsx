import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  RPD_STEPS,
  EMOTION_OPTIONS,
  DISTORTION_OPTIONS,
  type RpdFormState,
} from "@/lib/rpd";

const G = "hsl(var(--gold))";
const INK = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";

interface Props {
  value: RpdFormState;
  onChange: (next: RpdFormState) => void;
  /** Cor de destaque (usada nas bordas/numeração). */
  accent?: string;
}

const StepCard = ({
  n,
  question,
  term,
  description,
  accent,
  children,
}: {
  n: number;
  question: string;
  term: string;
  description: string;
  accent: string;
  children: React.ReactNode;
}) => (
  <section
    className="bg-white rounded-[10px] p-4 sm:p-5 space-y-3"
    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${accent}` }}
  >
    <header className="flex items-start gap-3">
      <span
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold"
        style={{ background: `${accent}`, color: "#fff" }}
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="font-display leading-snug" style={{ fontSize: 16, fontWeight: 700, color: INK }}>
          {question}
        </h3>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: accent, textTransform: "uppercase" }}>
          {term}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: MUTED }}>{description}</p>
      </div>
    </header>
    {children}
  </section>
);

const ScaleField = ({
  id,
  label,
  value,
  onChange,
  accent,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  accent: string;
}) => (
  <div className="rounded-lg p-3 space-y-2" style={{ background: "hsl(var(--muted))" }}>
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: INK }}>
        {label}
      </label>
      <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: accent }}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
    <div className="flex items-center gap-3">
      <Slider
        className="flex-1"
        value={[value ?? 0]}
        min={0}
        max={100}
        step={5}
        onValueChange={(v) => onChange(v[0])}
      />
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Math.max(0, Math.min(100, Number(raw)));
          onChange(Number.isNaN(n) ? null : n);
        }}
        className="w-20 h-10 text-base text-center"
        placeholder="—"
      />
    </div>
    <p style={{ fontSize: 11, color: MUTED }}>Opcional · 0 a 100%</p>
  </div>
);

export const RpdForm = ({ value, onChange, accent = G }: Props) => {
  const set = (patch: Partial<RpdFormState>) => onChange({ ...value, ...patch });

  const toggleEmotion = (name: string) => {
    const exists = value.emotions.find((e) => e.name === name);
    set({
      emotions: exists
        ? value.emotions.filter((e) => e.name !== name)
        : [...value.emotions, { name, before: null, after: null }],
    });
  };

  const setEmotion = (name: string, patch: Partial<{ before: number | null; after: number | null }>) =>
    set({ emotions: value.emotions.map((e) => (e.name === name ? { ...e, ...patch } : e)) });

  const toggleDistortion = (simple: string) =>
    set({
      distortions: value.distortions.includes(simple)
        ? value.distortions.filter((d) => d !== simple)
        : [...value.distortions, simple],
    });

  const step = (n: number) => {
    const s = RPD_STEPS.find((x) => x.n === n)!;
    return { n: s.n, question: s.question, term: s.term, description: s.description };
  };
  const stepFull = (n: number) => RPD_STEPS.find((x) => x.n === n)!;

  const textStep = (n: number, key: "situation" | "automatic_thought" | "behavior" | "rational_response", extra?: React.ReactNode) => {
    const s = stepFull(n);
    return (
      <StepCard key={s.n} n={s.n} question={s.question} term={s.term} description={s.description} accent={accent}>
        <Textarea
          id={`rpd-${key}`}
          rows={n === 6 ? 4 : 3}
          value={value[key]}
          onChange={(e) => set({ [key]: e.target.value } as Partial<RpdFormState>)}
          placeholder={s.placeholder}
          className="resize-y text-base leading-relaxed min-h-[96px]"
          autoCapitalize="sentences"
        />
        {extra}
      </StepCard>
    );
  };

  const chipStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: accent, color: "#fff", borderColor: accent }
      : { background: "#fff", color: INK, borderColor: "hsl(var(--border))" };

  return (
    <div className="space-y-3 sm:space-y-4">
      {textStep(1, "situation")}
      {textStep(
        2,
        "automatic_thought",
        <ScaleField
          id="rpd-belief-before"
          label="Quanto você acreditou nesse pensamento?"
          value={value.belief_before}
          onChange={(v) => set({ belief_before: v })}
          accent={accent}
        />,
      )}

      {/* Etapa 3 — emoções */}
      <StepCard {...step(3)} accent={accent}>
        <div className="flex flex-wrap gap-2">
          {EMOTION_OPTIONS.map((name) => {
            const active = value.emotions.some((e) => e.name === name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => toggleEmotion(name)}
                className="rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-strong"
                style={chipStyle(active)}
              >
                {name}
              </button>
            );
          })}
        </div>
        {value.emotions.some((e) => e.name === "Outra") && (
          <Input
            value={value.emotion_other}
            onChange={(e) => set({ emotion_other: e.target.value })}
            placeholder="Qual emoção?"
            className="h-11 text-base"
          />
        )}
        {value.emotions.length > 0 && (
          <div className="space-y-2">
            {value.emotions.map((e) => (
              <div key={e.name} className="rounded-lg p-3" style={{ background: "hsl(var(--muted))" }}>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                    {e.name === "Outra" && value.emotion_other.trim() ? value.emotion_other.trim() : e.name}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                    {e.before != null ? `${e.before}/100` : "—"}
                  </span>
                </div>
                <Slider
                  className="mt-2"
                  value={[e.before ?? 0]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setEmotion(e.name, { before: v[0] })}
                />
              </div>
            ))}
          </div>
        )}
      </StepCard>

      {textStep(4, "behavior")}

      {/* Etapa 5 — armadilhas do pensamento */}
      <StepCard {...step(5)} accent={accent}>
        <div className="grid gap-2 sm:grid-cols-2">
          {DISTORTION_OPTIONS.map((d) => {
            const active = value.distortions.includes(d.simple);
            return (
              <button
                key={d.simple}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDistortion(d.simple)}
                className="rounded-lg border px-3 py-2.5 text-left transition-colors focus-strong"
                style={chipStyle(active)}
              >
                <span className="block text-sm font-medium leading-snug">{d.simple}</span>
                {d.technical && (
                  <span
                    className="block text-xs mt-0.5"
                    style={{ color: active ? "rgba(255,255,255,0.8)" : MUTED }}
                  >
                    {d.technical}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {value.distortions.some((d) => d.startsWith("Outra")) && (
          <Input
            value={value.distortion_other}
            onChange={(e) => set({ distortion_other: e.target.value })}
            placeholder="Descreva, se quiser"
            className="h-11 text-base"
          />
        )}
      </StepCard>

      {textStep(6, "rational_response")}

      {/* E agora? */}
      <section
        className="bg-white rounded-[10px] p-4 sm:p-5 space-y-3"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${accent}` }}
      >
        <header className="space-y-1">
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: INK }}>
            E agora?
          </h3>
          <p style={{ fontSize: 13, color: MUTED }}>
            Depois de olhar para a situação de outra forma, veja o que mudou. Campos opcionais.
          </p>
        </header>
        <ScaleField
          id="rpd-belief-after"
          label="Quanto você acredita no pensamento inicial agora?"
          value={value.belief_after}
          onChange={(v) => set({ belief_after: v })}
          accent={accent}
        />
        {value.emotions.length > 0 ? (
          <div className="space-y-2">
            <p style={{ fontSize: 13, fontWeight: 600, color: INK }}>Como você está se sentindo agora?</p>
            {value.emotions.map((e) => (
              <div key={e.name} className="rounded-lg p-3" style={{ background: "hsl(var(--muted))" }}>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                    {e.name === "Outra" && value.emotion_other.trim() ? value.emotion_other.trim() : e.name}
                    {e.before != null && (
                      <span style={{ color: MUTED, fontWeight: 500 }}> · antes {e.before}/100</span>
                    )}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                    {e.after != null ? `${e.after}/100` : "—"}
                  </span>
                </div>
                <Slider
                  className="mt-2"
                  value={[e.after ?? 0]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setEmotion(e.name, { after: v[0] })}
                />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: MUTED }}>
            Selecione emoções na etapa 3 para acompanhar como elas estão agora.
          </p>
        )}
      </section>
    </div>
  );
};
