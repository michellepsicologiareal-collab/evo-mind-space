import { useEffect } from "react";
import { currentBuildSignature, remoteBuildSignature } from "@/lib/appUpdate";

const KEY = "psireal:public-fresh-reload";

/**
 * Garante que páginas públicas (ex.: confirmação de sessão) sempre mostrem a
 * versão publicada mais recente. Ao abrir, reabrir ou voltar para o link,
 * compara com a versão publicada e recarrega o mesmo endereço se estiver
 * desatualizada. No máximo uma recarga por versão, para evitar loops.
 */
export function useFreshPublicPage() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const remote = await remoteBuildSignature();
        const local = currentBuildSignature();
        if (!remote || !local || remote === local) return;
        if (sessionStorage.getItem(KEY) === remote) return;
        sessionStorage.setItem(KEY, remote);
        const url = new URL(window.location.href);
        url.searchParams.set("v", Date.now().toString(36));
        window.location.replace(url.toString());
      } finally {
        busy = false;
      }
    };
    void check();
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
