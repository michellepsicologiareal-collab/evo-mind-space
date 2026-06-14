import { Sparkles, type LucideIcon } from "lucide-react";

interface PageIntroProps {
  /** Breve frase que diz o que a tela faz e quando usar. */
  description: string;
  /** Ícone opcional à esquerda (lucide). */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Card acolhedor exibido no topo das telas do app, explicando ao psi
 * para que serve aquela tela e quando usá-la. Mantém tom curto e prático.
 */
export const PageIntro = ({ description, icon: Icon = Sparkles, className = "" }: PageIntroProps) => (
  <div
    className={`flex items-start gap-3 rounded-2xl border border-lilac/20 bg-lilac/5 p-4 md:p-5 ${className}`}
  >
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lilac/15 text-lilac">
      <Icon className="h-4 w-4" />
    </span>
    <p className="text-sm leading-relaxed text-foreground/80">{description}</p>
  </div>
);
