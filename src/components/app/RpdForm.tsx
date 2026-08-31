import { useState } from "react";
import { Check, ChevronDown, Lightbulb, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  RPD_STEPS,
  EMOTION_OPTIONS,
  DISTORTION_OPTIONS,
  type DistortionOption,
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
  note,
  accent,
  children,
}: {
  n: number;
  question: string;
  term: string;
  description: string;
  note?: string;
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
        {note && (
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED, opacity: 0.85 }}>{note}</p>
        )}
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
  const [learnMore, setLearnMore] = useState<DistortionOption | null>(null);
  const set = (patch: Partial<RpdFormState>) => onChange({ ...value, ...patch });
  const selectedDistortionsCount = value.distortions.filter(
    (d) => DISTORTION_OPTIONS.some((o) => o.simple === d && !o.notDistortion),
  ).length;

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

      {/* Etapa 5 — armadilhas do pensamento (cards educativos) */}
      <StepCard {...step(5)} accent={accent}>
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Armadilhas do pensamento">
          {DISTORTION_OPTIONS.map((d) => {
            const active = value.distortions.includes(d.simple);
            const descId = `rpd-distortion-desc-${d.simple.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div
                key={d.simple}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={d.technical ? `${d.simple} (${d.technical})` : d.simple}
                aria-describedby={descId}
                onClick={() => toggleDistortion(d.simple)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                    e.preventDefault();
                    toggleDistortion(d.simple);
                  }
                }}
                className="relative rounded-xl border px-3 py-3 text-left transition-colors cursor-pointer focus-strong select-none"

                style={
                  active
                    ? { background: "rgba(150,117,206,0.08)", borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }
                    : { background: "#fff", borderColor: "hsl(var(--border))" }
                }
              >
                {active && (
                  <span
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: accent, color: "#fff" }}
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <span className="block pr-6 text-sm font-semibold leading-snug" style={{ color: INK }}>
                  {d.simple}
                </span>
                {d.technical && (
                  <span className="block mt-0.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                    {d.technical}
                  </span>
                )}
                <span id={descId} className="block mt-1.5 text-xs leading-relaxed" style={{ color: MUTED }}>
                  {d.description}
                </span>

                {d.example && (
                  <span className="block mt-1.5 text-xs italic leading-relaxed" style={{ color: MUTED }}>
                    Ex.: {d.example}
                  </span>
                )}
                {!d.notDistortion && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLearnMore(d);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors hover:underline focus-strong"
                    style={{ color: accent }}
                  >
                    <Lightbulb className="h-3 w-3" />
                    Entender melhor
                  </button>
                )}
              </div>
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

        {/* Resumo das armadilhas selecionadas — pode ajustar sem perder a escolha */}
        {value.distortions.length > 0 && (
          <div
            className="rounded-lg px-3 py-3 space-y-2"
            style={{ background: "hsl(var(--muted))" }}
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-semibold" style={{ color: INK }}>
              {selectedDistortionsCount > 0
                ? `Você identificou ${selectedDistortionsCount} ${
                    selectedDistortionsCount === 1 ? "possível armadilha" : "possíveis armadilhas"
                  } nesse pensamento. Vamos investigar isso juntos.`
                : "Tudo bem não identificar agora — você pode voltar a esse registro depois."}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {value.distortions.map((simple) => {
                const opt = DISTORTION_OPTIONS.find((o) => o.simple === simple);
                const label =
                  simple.startsWith("Outra") && value.distortion_other.trim()
                    ? value.distortion_other.trim()
                    : simple;
                return (
                  <li key={simple}>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={{ background: "#fff", borderColor: accent, color: INK }}
                    >
                      <span>
                        {label}
                        {opt?.technical ? (
                          <span style={{ color: MUTED }}> · {opt.technical}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDistortion(simple)}
                        aria-label={`Remover ${label}`}
                        className="rounded-full p-0.5 transition-colors hover:bg-muted focus-strong"
                      >
                        <X className="h-3 w-3" style={{ color: MUTED }} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Você pode voltar e ajustar a qualquer momento — nada do que já escolheu será perdido.
            </p>
          </div>
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

      {/* Recurso educativo — "Entender melhor" */}
      <Dialog open={learnMore != null} onOpenChange={(open) => !open && setLearnMore(null)}>
        <DialogContent className="max-w-md">
          {learnMore && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-base leading-snug">
                  {learnMore.simple}
                </DialogTitle>
                {learnMore.technical && (
                  <DialogDescription className="text-[11px] font-semibold uppercase tracking-wide">
                    {learnMore.technical}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="space-y-4 text-sm leading-relaxed">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que é</p>
                  <p className="mt-1">{learnMore.description}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Como costuma aparecer
                  </p>
                  <p className="mt-1">{learnMore.howAppears}</p>
                </div>
                {learnMore.examples.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exemplos</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 italic text-muted-foreground">
                      {learnMore.examples.map((ex) => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-lg p-3" style={{ background: "hsl(var(--muted))" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
                    Uma pergunta para investigar
                  </p>
                  <p className="mt-1 text-sm">{learnMore.question}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Não existe resposta certa aqui — o objetivo é investigar esse pensamento com curiosidade, possivelmente
                  junto com seu terapeuta.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
