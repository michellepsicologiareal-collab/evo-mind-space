import { Sparkles } from "lucide-react";

const COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  TCC: { bg: "#EEEDFE", fg: "#534AB7", border: "#AFA9EC" },
  TE:  { bg: "#EAF3DE", fg: "#3D5C35", border: "#A6C48A" },
  ACT: { bg: "#FCEAD9", fg: "#A57164", border: "#E0B49C" },
};

const CONTEXT_BLOCK: Record<string, string> = {
  TCC: "Modelo cognitivo de Beck",
  TE:  "Esquemas e modos de Young",
  ACT: "Hexaflex de Hayes",
};

interface Props {
  abordagem?: string | null;
  label?: string | null;
  className?: string;
}

/**
 * Badge mostrando qual abordagem do plano + qual bloco de contexto a IA usou.
 * Renderize ao lado do output de IA (formulação, supervisão, coach, resumo, organizar notas).
 */
export const AbordagemBadge = ({ abordagem, label, className = "" }: Props) => {
  if (!abordagem) return null;
  const key = String(abordagem).toUpperCase();
  const c = COLORS[key] ?? COLORS.TCC;
  const contexto = CONTEXT_BLOCK[key] ?? CONTEXT_BLOCK.TCC;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium ${className}`}
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
      title={label ?? undefined}
    >
      <Sparkles className="h-3 w-3" />
      <span>IA · Abordagem {key}</span>
      <span className="opacity-60">·</span>
      <span className="font-normal">Contexto: {contexto}</span>
    </div>
  );
};
