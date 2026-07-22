import { useEffect, useState } from "react";
import { HelpCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HelpCardSection {
  label: string;
  content: string;
}

interface HelpCardProps {
  /** Unique id used to persist dismissal (localStorage). */
  id: string;
  title: string;
  description: string;
  sections?: HelpCardSection[];
  className?: string;
}

const storageKey = (id: string) => `psireal.help.${id}.hidden`;

/**
 * Contextual help card shown at the top of a module.
 * - Discreet lilac card with title, description and optional sections.
 * - "Entendi" hides it and persists the preference.
 * - A "?" icon button reopens it whenever needed.
 */
export const HelpCard = ({ id, title, description, sections, className }: HelpCardProps) => {
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey(id)) === "1");
    } catch {
      /* ignore */
    }
  }, [id]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey(id), "1"); } catch {}
    setHidden(true);
  };

  const reopen = () => {
    try { localStorage.removeItem(storageKey(id)); } catch {}
    setHidden(false);
  };

  if (hidden) {
    return (
      <div className={cn("flex justify-end -mt-1 mb-2", className)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reopen}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
          aria-label={`Reabrir ajuda: ${title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Ajuda
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative mb-4 rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3 sm:px-5 sm:py-4",
        className,
      )}
      role="note"
      aria-label={`Ajuda: ${title}`}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        aria-label="Ocultar ajuda"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>

          {sections && sections.length > 0 && (
            <ul className="mt-2 space-y-1">
              {sections.map((s) => (
                <li key={s.label} className="text-xs sm:text-[13px] leading-relaxed">
                  <span className="font-medium text-foreground">{s.label}: </span>
                  <span className="text-muted-foreground">{s.content}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={dismiss}
              className="h-7 text-xs"
            >
              Entendi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCard;
