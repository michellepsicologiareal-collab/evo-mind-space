import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const Pulse = ({ className }: { className?: string }) => (
  <div className={cn("rounded bg-muted motion-safe:animate-pulse", className)} />
);

export const LoadingRegion = ({
  children,
  label = "Carregando conteúdo",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) => (
  <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeleton = ({ count = 4, className }: CardSkeletonProps) => (
  <LoadingRegion className={cn("grid md:grid-cols-2 gap-4", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Pulse className="h-11 w-11 rounded-full" />
          <div className="space-y-2 flex-1">
            <Pulse className="h-4 w-2/3" />
            <Pulse className="h-3 w-1/3" />
          </div>
        </div>
        <div className="space-y-2">
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-3/4" />
        </div>
      </div>
    ))}
  </LoadingRegion>
);

export const ListSkeleton = ({ count = 6 }: { count?: number }) => (
  <LoadingRegion className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
        <Pulse className="h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-1/2" />
          <Pulse className="h-3 w-3/4" />
        </div>
        <Pulse className="hidden h-9 w-24 rounded-full sm:block" />
      </div>
    ))}
  </LoadingRegion>
);

export const MetricSkeleton = ({ count = 4, className }: CardSkeletonProps) => (
  <LoadingRegion className={cn("grid grid-cols-2 gap-2.5 lg:grid-cols-4", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="min-h-24 rounded-2xl border border-border bg-card p-4">
        <Pulse className="h-3 w-2/3" />
        <Pulse className="mt-4 h-7 w-1/2" />
        <Pulse className="mt-3 h-3 w-3/4" />
      </div>
    ))}
  </LoadingRegion>
);

export const CalendarSkeleton = ({ mode = "month" }: { mode?: "month" | "week" }) => (
  <LoadingRegion className={cn("grid min-w-0 gap-3", mode === "month" ? "xl:grid-cols-2" : "grid-cols-1")} label="Carregando agenda">
    {Array.from({ length: mode === "month" ? 2 : 5 }).map((_, card) => (
      <div key={card} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className={cn("grid gap-2", mode === "month" ? "grid-cols-7" : "grid-cols-[4rem_1fr]")}>
          {Array.from({ length: mode === "month" ? 35 : 4 }).map((_, i) => (
            <Pulse key={i} className={cn(mode === "month" ? "aspect-square rounded-lg" : i === 0 ? "h-4 w-12" : "h-4 w-full")} />
          ))}
        </div>
      </div>
    ))}
  </LoadingRegion>
);

export const FormSkeleton = () => (
  <LoadingRegion className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6" label="Carregando formulário">
    <div className="space-y-2">
      <Pulse className="h-8 w-56 max-w-full" />
      <Pulse className="h-4 w-80 max-w-full" />
    </div>
    <MetricSkeleton count={4} />
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border bg-card p-5">
        <Pulse className="h-5 w-48 max-w-full" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Pulse className="h-11 w-full" />
          <Pulse className="h-11 w-full" />
          <Pulse className="h-24 w-full sm:col-span-2" />
        </div>
      </div>
    ))}
  </LoadingRegion>
);
