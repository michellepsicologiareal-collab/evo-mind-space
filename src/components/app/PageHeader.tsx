import { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { PageIntro } from "./PageIntro";

interface PageHeaderProps {
  /** Pequeno rótulo acima do título (opcional). Ex.: "Financeiro". */
  eyebrow?: string;
  /** Título principal da tela. */
  title: string;
  /** Subtítulo curto exibido abaixo do título. */
  subtitle?: string;
  /** Ícone redondo à esquerda do título (opcional). */
  icon?: LucideIcon;
  /** Cor de fundo do ícone (token Tailwind). Default: bg-accent/10 text-accent. */
  iconClassName?: string;
  /** Ações alinhadas à direita do header (botões, filtros, busca). */
  actions?: ReactNode;
  /** Descrição acolhedora exibida no card lilás logo abaixo do header. */
  intro?: string;
  /** Chips/stats exibidos abaixo do subtítulo (badges, contadores). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Header unificado das telas internas do app. Padroniza tipografia,
 * espaçamento, ações e descrição acolhedora (PageIntro).
 */
export const PageHeader = ({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  iconClassName = "bg-accent/10 text-accent",
  actions,
  intro,
  meta,
  className = "",
}: PageHeaderProps) => (
  <div className={`space-y-4 ${className}`}>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        {Icon && (
          <span
            className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-2xl">
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">{actions}</div>
      )}
    </header>
    {intro && <PageIntro description={intro} />}
  </div>
);
