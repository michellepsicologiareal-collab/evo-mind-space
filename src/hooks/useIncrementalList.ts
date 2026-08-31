import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Renderização incremental (virtualização simples por janela crescente).
 *
 * Mantém o DOM pequeno quando há muitos registros: renderiza apenas os
 * primeiros `chunk` itens e vai revelando o restante conforme o usuário
 * rola até o sentinela. A janela é reiniciada sempre que a lista muda
 * (por exemplo, ao trocar de mês ou de dia), mantendo a navegação rápida.
 */
export function useIncrementalList<T>(items: T[], chunk = 30) {
  const [limit, setLimit] = useState(chunk);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reinicia a janela quando a lista de origem muda (troca de mês/dia/filtro)
  useEffect(() => {
    setLimit(chunk);
  }, [items, chunk]);

  const visible = useMemo(() => (items.length <= limit ? items : items.slice(0, limit)), [items, limit]);
  const hasMore = items.length > visible.length;

  const loadMore = useCallback(() => setLimit((prev) => prev + chunk), [chunk]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, limit]);

  return { visible, hasMore, sentinelRef, loadMore, total: items.length };
}
