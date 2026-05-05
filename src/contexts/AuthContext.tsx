import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SupabaseResult<T> = { data: T | null; error: { message?: string } | null };

const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000): Promise<T> =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error("Tempo esgotado ao validar acesso.")), ms)
    ),
  ]);

const SESSION_RETURN_KEY = "psireal_return_url";
const SESSION_EXPIRED_KEY = "psireal_session_expired";

export const getSessionExpiredFlag = () => {
  const flag = sessionStorage.getItem(SESSION_EXPIRED_KEY);
  if (flag) sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return flag === "1";
};

export const getReturnUrl = () => {
  const url = sessionStorage.getItem(SESSION_RETURN_KEY);
  if (url) sessionStorage.removeItem(SESSION_RETURN_KEY);
  return url;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  const checkApproval = async (userId: string) => {
    try {
      const { data: ensuredProfile, error: ensureError } = await withTimeout(
        (supabase as any).rpc("ensure_current_profile")
      ) as SupabaseResult<Array<{ is_approved: boolean }>>;

      if (!ensureError && ensuredProfile?.[0]) {
        setIsApproved(Boolean(ensuredProfile[0].is_approved));
        return;
      }
    } catch (error) {
      console.warn("Validação inicial do perfil demorou demais; tentando consulta direta.", error);
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("is_approved")
          .eq("id", userId)
          .maybeSingle()
      ) as SupabaseResult<{ is_approved: boolean }>;

      if (error) {
        console.warn("Não foi possível verificar a aprovação do perfil:", error.message);
        setIsApproved(false);
        return;
      }

      setIsApproved(data?.is_approved ?? false);
    } catch (error) {
      console.warn("Falha ao verificar aprovação do perfil:", error);
      setIsApproved(false);
    }
  };

  // Proactive token refresh: refresh 5 min before expiry
  const scheduleTokenRefresh = useCallback((sess: Session) => {
    if (!sess.expires_at) return;
    const expiresAtMs = sess.expires_at * 1000;
    const refreshInMs = expiresAtMs - Date.now() - 5 * 60 * 1000; // 5 min before
    if (refreshInMs <= 0) {
      // Already close to expiry, refresh now
      supabase.auth.refreshSession();
      return;
    }
    const timer = window.setTimeout(() => {
      supabase.auth.refreshSession();
    }, refreshInMs);
    return timer;
  }, []);

  useEffect(() => {
    let mounted = true;
    let refreshTimer: number | undefined;

    const clearSession = () => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setIsApproved(null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // Handle session expiry / sign out while using the app
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !newSession)) {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        // Only save return URL if user was previously logged in (session expired)
        if (user && window.location.pathname.startsWith("/app")) {
          sessionStorage.setItem(SESSION_RETURN_KEY, window.location.pathname + window.location.search);
          sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
        }
        clearSession();
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Schedule proactive refresh
      if (newSession) {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = scheduleTokenRefresh(newSession);
      }

      if (newSession?.user) {
        setLoading(true);
      }

      // defer to avoid deadlock with Supabase client
      setTimeout(() => {
        if (!mounted) return;
        if (newSession?.user) {
          checkApproval(newSession.user.id).finally(() => mounted && setLoading(false));
        } else {
          setIsApproved(null);
          setLoading(false);
        }
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: existing }, error }) => {
      if (error) {
        console.warn("Sessão salva inválida; mostrando login novamente:", error.message);
        clearSession();
        return;
      }

      if (!mounted) return;
      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing) {
        refreshTimer = scheduleTokenRefresh(existing);
      }

      if (existing?.user) {
        checkApproval(existing.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(clearSession);

    return () => {
      mounted = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isApproved, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
