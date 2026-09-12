/**
 * Cache simples em memória para consultas que mudam pouco
 * (perfil do psicólogo, lista de pacientes, serviços).
 *
 * - TTL: enquanto o dado estiver "fresco", nenhuma nova chamada é feita.
 * - Dedupe: chamadas simultâneas com a mesma chave compartilham a mesma promessa.
 * - Invalidação: `invalidateCache(prefix)` limpa tudo que começa com o prefixo.
 *
 * Não usar para dados financeiros/sessões que precisam estar sempre atuais.
 */

type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; force?: boolean }
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTL;

  if (!options?.force) {
    const hit = store.get(key) as Entry<T> | undefined;
    if (hit && Date.now() - hit.at < ttl) return hit.value;

    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  }

  const promise = (async () => {
    try {
      const value = await fetcher();
      store.set(key, { at: Date.now(), value });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Retorna o valor em cache (mesmo vencido) sem disparar chamada. */
export function peekCache<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

/** Remove entradas cujo nome começa com o prefixo informado. */
export function invalidateCache(prefix: string) {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of Array.from(inflight.keys())) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}
