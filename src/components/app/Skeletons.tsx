import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeleton = ({ count = 4, className }: CardSkeletonProps) => (
  <div className={cn("grid md:grid-cols-2 gap-4", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-card border border-border p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
      </div>
    ))}
  </div>
);

export const ListSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-card border border-border p-4 animate-pulse flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
        <div className="h-9 w-24 rounded-full bg-muted" />
      </div>
    ))}
  </div>
);
