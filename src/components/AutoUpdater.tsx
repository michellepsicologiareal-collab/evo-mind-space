import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyUpdate,
  consumeUpdatedNotice,
  currentBuildSignature,
  hoursSinceLastCheck,
  isSafeToReload,
  markLastCheck,
  remoteBuildSignature,
} from "@/lib/appUpdate";

const POLL_MS = 30 * 60 * 1000; // 30 min

/**
 * Mantém o app sempre na versão publicada mais recente.
 * Não interrompe preenchimentos: espera um momento seguro (troca de página,
 * aba oculta ou nenhum campo em edição) para aplicar.
 */
export const AutoUpdater = () => {
  const location = useLocation();
  const { user } = useAuth();
  const baseline = useRef<string>("");
  const pending = useRef(false);

  useEffect(() => {
    if (consumeUpdatedNotice()) {
      toast.success("O Psi Real foi atualizado para a versão mais recente");
    }
    baseline.current = currentBuildSignature();
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let cancelled = false;

    const maybeApply = () => {
      if (!pending.current || cancelled) return;
      if (!isSafeToReload()) return;
      void applyUpdate();
    };

    const check = async () => {
      if (cancelled || pending.current) return;
      markLastCheck();
      const remote = await remoteBuildSignature();
      if (cancelled || !remote || !baseline.current) return;
      if (remote !== baseline.current) {
        pending.current = true;
        maybeApply();
      }
    };

    void check();

    const interval = window.setInterval(() => void check(), POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        // Aba oculta: momento seguro para aplicar o que já estava pendente.
        maybeApply();
        return;
      }
      if (hoursSinceLastCheck() >= 24) void check();
      maybeApply();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verifica ao entrar/sair de sessão (login) e aplica em troca de página.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (pending.current && isSafeToReload()) void applyUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id]);

  return null;
};
