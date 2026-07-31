/**
 * Auto-update do Psi Real.
 *
 * Detecta se existe uma nova versão publicada comparando as assinaturas dos
 * assets referenciados pelo index.html servido pela hospedagem com os assets
 * carregados na aba atual. Nenhum dado do usuário é apagado — apenas a página
 * é recarregada quando for seguro.
 */

const UPDATED_FLAG = "psireal:updated-notice";
const LAST_CHECK_KEY = "psireal:last-update-check";

/** Assinatura dos scripts/estilos carregados na aba atual. */
export function currentBuildSignature(): string {
  const urls: string[] = [];
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((el) => urls.push(el.src));
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="modulepreload"]')
    .forEach((el) => urls.push(el.href));
  return normalize(urls);
}

/** Assinatura dos assets do index.html publicado agora (sem cache). */
export async function remoteBuildSignature(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const urls = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
      .map((m) => m[1])
      .filter((u) => /\.(js|mjs|css)(\?|$)/.test(u));
    if (!urls.length) return null;
    return normalize(urls);
  } catch {
    return null;
  }
}

function normalize(urls: string[]): string {
  return urls
    .map((u) => {
      try {
        return new URL(u, window.location.origin).pathname;
      } catch {
        return u;
      }
    })
    .filter((p) => /\.(js|mjs|css)$/.test(p))
    .sort()
    .join("|");
}

export function markLastCheck() {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hoursSinceLastCheck(): number {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return Number.POSITIVE_INFINITY;
    return (Date.now() - Number(raw)) / 3_600_000;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Verdadeiro quando a usuária não está no meio de um preenchimento. */
export function isSafeToReload(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (active) {
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable) {
      return false;
    }
  }
  // Diálogos/drawers abertos indicam trabalho em andamento.
  if (document.querySelector('[role="dialog"], [data-state="open"][role="alertdialog"]')) {
    return false;
  }
  return true;
}

/** Limpa caches HTTP do próprio domínio (não toca em dados do usuário). */
async function clearHttpCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

export async function applyUpdate() {
  try {
    sessionStorage.setItem(UPDATED_FLAG, "1");
  } catch {
    /* ignore */
  }
  await clearHttpCaches();
  window.location.reload();
}

export function consumeUpdatedNotice(): boolean {
  try {
    if (sessionStorage.getItem(UPDATED_FLAG) === "1") {
      sessionStorage.removeItem(UPDATED_FLAG);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
