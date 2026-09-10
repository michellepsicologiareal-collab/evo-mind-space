import { useEffect, useRef } from "react";

/**
 * Triggers `onRefresh` automatically when:
 * - the tab/window regains focus
 * - the document becomes visible again
 * - the keep-alive route becomes active (custom "route-active" event)
 *
 * Importante: as páginas do app ficam montadas em segundo plano (keep-alive).
 * Por isso só atualizamos a página que está realmente visível — caso contrário
 * cada retorno ao app dispararia dezenas de consultas ao mesmo tempo.
 */
export function useAutoRefresh(onRefresh: () => void | Promise<void>, opts?: { routePath?: string; minIntervalMs?: number }) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;
  const lastRef = useRef(Date.now());
  const minInterval = opts?.minIntervalMs ?? 60_000;
  const routePath = opts?.routePath;

  useEffect(() => {
    const isActiveRoute = () => !routePath || window.location.pathname === routePath;

    const isBusy = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable) return true;
      }
      return !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
    };

    const trigger = (force = false) => {
      if (!isActiveRoute()) return;
      if (document.visibilityState !== "visible") return;
      if (isBusy()) return;
      const now = Date.now();
      if (!force && now - lastRef.current < minInterval) return;
      lastRef.current = now;
      try { void cbRef.current(); } catch { /* noop */ }
    };

    const onFocus = () => trigger();
    const onVisibility = () => { if (document.visibilityState === "visible") trigger(); };
    const onRouteActive = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (routePath && detail?.path !== routePath) return;
      trigger();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("route-active", onRouteActive as EventListener);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("route-active", onRouteActive as EventListener);
    };
  }, [routePath, minInterval]);
}
