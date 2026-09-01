import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FREE_PLAN_NAME,
  STATUS_LABELS,
  STATUS_DOTS,
  isProblemStatus,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";

/** Indicador discreto do plano do usuário, exibido no painel. */
export function PlanStatusBadge({ className }: { className?: string }) {
  const { status, plan, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return null;

  const isFree = status === "free";
  const problem = isProblemStatus(status);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2",
        problem && "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Plano</p>
        <p className="text-sm font-medium text-foreground truncate">
          {isFree ? FREE_PLAN_NAME : plan.planName}
        </p>
      </div>

      {problem ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {STATUS_LABELS[status]}
        </span>
      ) : status === "active" ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
          Ativo
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOTS[status])} />
          {STATUS_LABELS[status]}
        </span>
      )}

      <Button
        variant={problem ? "default" : "outline"}
        size="sm"
        className="h-8 rounded-full text-xs whitespace-nowrap"
        onClick={() => navigate("/app/meu-plano")}
      >
        {problem ? "Ver Meu Plano" : isFree ? "Fazer upgrade" : "Ver plano"}
      </Button>
    </div>
  );
}
