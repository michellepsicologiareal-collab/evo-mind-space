import { useMemo } from "react";

const EMOTIONS = ["Ansiedade", "Tristeza", "Raiva", "Culpa", "Vergonha", "Alegria", "Esperança"] as const;
const PREFIX = "Emoções:";

interface Props {
  note: string;
  onChange: (next: string) => void;
}

/**
 * Multi-select chips de emoções. Persistem como uma linha prefixada
 * "Emoções: A · B · C" no início do campo de observação do humor.
 */
export const EmotionChips = ({ note, onChange }: Props) => {
  const { selected, rest } = useMemo(() => {
    const lines = (note ?? "").split(/\r?\n/);
    const first = lines[0]?.trim() ?? "";
    if (first.startsWith(PREFIX)) {
      const tags = first
        .slice(PREFIX.length)
        .split(/[·,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      return { selected: new Set(tags), rest: lines.slice(1).join("\n").replace(/^\n+/, "") };
    }
    return { selected: new Set<string>(), rest: note ?? "" };
  }, [note]);

  const toggle = (emo: string) => {
    const next = new Set(selected);
    next.has(emo) ? next.delete(emo) : next.add(emo);
    const order = EMOTIONS.filter((e) => next.has(e));
    const prefix = order.length ? `${PREFIX} ${order.join(" · ")}` : "";
    const combined = [prefix, rest].filter(Boolean).join("\n");
    onChange(combined);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOTIONS.map((emo) => {
        const active = selected.has(emo);
        return (
          <button
            key={emo}
            type="button"
            onClick={() => toggle(emo)}
            className="text-xs rounded-full px-3 py-1 transition-colors"
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 600,
              background: active ? "rgba(150,117,206,0.12)" : "#fff",
              color: active ? "hsl(var(--primary-dark))" : "hsl(var(--primary-glow))",
              border: active ? "0.5px solid rgba(150,117,206,0.35)" : "0.5px solid hsl(var(--border))",
            }}
          >
            {emo}
          </button>
        );
      })}
    </div>
  );
};
