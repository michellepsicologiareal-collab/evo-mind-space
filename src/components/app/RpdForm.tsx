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

// Tons pastel dos post-its (amarelo, rosa, lilás, azul, verde) + neutro.
const POST_IT_COLORS = [
  { bg: "#FDF3C8", edge: "#EAD98A" }, // amarelo
  { bg: "#FBE3E8", edge: "#F0C3CE" }, // rosa
  { bg: "#EDE7F8", edge: "#D5C8EC" }, // lilás
  { bg: "#E2F0FB", edge: "#BEDCF2" }, // azul
  { bg: "#E4F3E6", edge: "#C4E3C9" }, // verde
];
const POST_IT_NEUTRAL = { bg: "#F4F2EC", edge: "#DEDACB" };
// Pequenas inclinações alternadas para o efeito de post-it colado.
const POST_IT_TILTS = [-0.6, 0.5, -0.4, 0.7, -0.5];

export const RpdForm = ({ value, onChange, accent = G }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
    return { n: s.n, question: s.question, term: s.term, description: s.description, note: s.note };
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

      {/* Etapa 5 — armadilhas do pensamento (post-its psicoeducativos) */}
      <StepCard {...step(5)} accent={accent}>
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Armadilhas do pensamento">
          {DISTORTION_OPTIONS.map((d, i) => {
            const active = value.distortions.includes(d.simple);
            const color = d.notDistortion ? POST_IT_NEUTRAL : POST_IT_COLORS[i % POST_IT_COLORS.length];
            const tilt = POST_IT_TILTS[i % POST_IT_TILTS.length];
            const slug = d.simple.replace(/\s+/g, "-").toLowerCase();
            const descId = `rpd-distortion-desc-${slug}`;
            const moreId = `rpd-distortion-more-${slug}`;
            const isOpen = Boolean(expanded[d.simple]);
            const hasMore = Boolean(d.howAppears || d.question);
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
                className="relative rounded-lg px-3.5 py-3 text-left cursor-pointer focus-strong select-none transition-shadow"
                style={{
                  background: color.bg,
                  transform: `rotate(${tilt}deg)`,
                  border: `2px solid ${active ? accent : color.edge}`,
                  boxShadow: active
                    ? "0 6px 14px rgba(0,0,0,0.14)"
                    : "0 2px 6px rgba(0,0,0,0.08)",
                }}
              >
                {/* Círculo de seleção — sempre visível, não depende de cor */}
                <span
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{
                    border: `2px solid ${active ? accent : "rgba(0,0,0,0.28)"}`,
                    background: active ? accent : "transparent",
                    color: "#fff",
                  }}
                  aria-hidden
                >
                  {active && <Check className="h-3 w-3" strokeWidth={3.5} />}
                </span>
                <span className="block pr-7 text-sm font-semibold leading-snug" style={{ color: "#2B2B2B" }}>
                  {d.simple}
                </span>
                {d.technical && (
                  <span
                    className="block mt-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ color: "rgba(0,0,0,0.5)" }}
                  >
                    {d.technical}
                  </span>
                )}
                <span id={descId} className="block mt-1.5 text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.62)" }}>
                  {d.description}
                </span>
                {d.example && (
                  <span className="block mt-1.5 text-xs italic leading-relaxed" style={{ color: "rgba(0,0,0,0.55)" }}>
                    Ex.: {d.example}
                  </span>
                )}

                {hasMore && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={moreId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => ({ ...prev, [d.simple]: !prev[d.simple] }));
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors hover:underline focus-strong"
                    style={{ color: "rgba(0,0,0,0.68)" }}
                  >
                    <Lightbulb className="h-3 w-3" />
                    {isOpen ? "Mostrar menos" : "Entender melhor"}
                    <ChevronDown
                      className="h-3 w-3 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                )}
                {hasMore && isOpen && (
                  <div
                    id={moreId}
                    className="mt-2 space-y-2 rounded-md p-2.5 text-xs leading-relaxed"
                    style={{ background: "rgba(255,255,255,0.55)", color: "rgba(0,0,0,0.68)" }}
                  >
                    {d.howAppears && <p>{d.howAppears}</p>}
                    {d.question && (
                      <p>
                        <span className="font-semibold">Pergunte-se:</span> {d.question}
                      </p>
                    )}
                  </div>
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
    </div>
  );
};
