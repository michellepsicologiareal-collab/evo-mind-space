import { useEffect, useRef } from "react";

/**
 * Triggers `onRefresh` automatically when:
 * - the tab/window regains focus
 * - the document becomes visible again
 * - the keep-alive route becomes active (custom "route-active" event)
 *
 * Throttled to avoid back-to-back reloads.
 */
export function useAutoRefresh(onRefresh: () => void | Promise<void>, opts?: { routePath?: string; minIntervalMs?: number }) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;
  const lastRef = useRef(0);
  const minInterval = opts?.minIntervalMs ?? 1500;

  useEffect(() => {
    const trigger = () => {
      const now = Date.now();
      if (now - lastRef.current < minInterval) return;
      lastRef.current = now;
      try { void cbRef.current(); } catch { /* noop */ }
    };

    const onFocus = () => trigger();
    const onVisibility = () => { if (document.visibilityState === "visible") trigger(); };
    const onRouteActive = (e: Event) => {
      if (!opts?.routePath) return trigger();
      const detail = (e as CustomEvent).detail;
      if (detail?.path === opts.routePath) trigger();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("route-active", onRouteActive as EventListener);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("route-active", onRouteActive as EventListener);
    };
  }, [opts?.routePath, minInterval]);
}
