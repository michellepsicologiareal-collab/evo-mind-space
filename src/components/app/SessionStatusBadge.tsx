import { useAuth } from "@/contexts/AuthContext";

/**
 * Small fixed-position badge showing the current auth status.
 * Useful for confirming when Playwright / the preview is authenticated.
 * Toggle off by setting localStorage.setItem("psireal:hideSessionBadge","1").
 */
export const SessionStatusBadge = () => {
  const { user, loading } = useAuth();

  if (typeof window !== "undefined" && window.localStorage.getItem("psireal:hideSessionBadge") === "1") {
    return null;
  }

  const state = loading ? "loading" : user ? "signed_in" : "signed_out";
  const color =
    state === "signed_in"
      ? "bg-emerald-500"
      : state === "signed_out"
        ? "bg-destructive"
        : "bg-muted-foreground";
  const label =
    state === "signed_in" ? "signed_in" : state === "signed_out" ? "signed_out" : "loading";

  return (
    <div
      data-testid="session-status-badge"
      data-session-status={state}
      className="fixed bottom-3 right-3 z-[9999] flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-md backdrop-blur pointer-events-none select-none"
      title={user?.email ?? "sem sessão"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="uppercase tracking-wide">{label}</span>
      {user?.email && <span className="text-muted-foreground normal-case">· {user.email}</span>}
    </div>
  );
};
