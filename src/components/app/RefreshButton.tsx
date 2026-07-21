import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RefreshButtonProps {
  className?: string;
}

export function RefreshButton({ className }: RefreshButtonProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Atualizar página"
            onClick={() => window.location.reload()}
            className={`h-10 rounded-full gap-2 ${className ?? ""}`}
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Atualizar página</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
