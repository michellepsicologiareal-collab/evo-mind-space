import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    // Try RPC first, then direct query — never throw
    try {
      const { data: ensuredProfile, error: ensureError } = await withTimeout(
        (supabase as any).rpc("ensure_current_profile")
      ) as SupabaseResult<Array<{ is_approved: boolean }>>;

      if (!ensureError && ensuredProfile?.[0]) {
        setIsApproved(Boolean(ensuredProfile[0].is_approved));
        return;
      }
    } catch {
      // silent — fall through to direct query
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("is_approved")
          .eq("id", userId)
          .maybeSingle()
      ) as SupabaseResult<{ is_approved: boolean }>;

      if (!error && data) {
        setIsApproved(data.is_approved ?? false);
        return;
      }
    } catch {
      // silent
    }

    // If both fail, default to false (unapproved) — don't throw
    console.warn("Não foi possível verificar aprovação; assumindo não aprovado.");
    setIsApproved(false);
  };

  useEffect(() => {
    let mounted = true;
    let lastCheckedUserId: string | null = null;

    const clearSession = () => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setIsApproved(null);
      lastCheckedUserId = null;
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        if (user && window.location.pathname.startsWith("/app")) {
          sessionStorage.setItem(SESSION_RETURN_KEY, window.location.pathname + window.location.search);
          sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
        }
        clearSession();
        return;
      }

      // Always keep session/user fresh, but DO NOT re-trigger loading state
      // for token refreshes or user updates — that would unmount the current page.
      setSession(newSession);
      setUser(newSession?.user ?? null);

      const newUserId = newSession?.user?.id ?? null;
      const isNewUser = newUserId && newUserId !== lastCheckedUserId;

      // Only re-check approval when the user actually changed (sign-in / account swap).
      // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION (same user) → skip the loader.
      if (isNewUser && event !== "TOKEN_REFRESHED") {
        lastCheckedUserId = newUserId;
        setTimeout(() => {
          if (!mounted) return;
          checkApproval(newUserId).finally(() => mounted && setLoading(false));
        }, 0);
      } else if (!newUserId) {
        lastCheckedUserId = null;
        setIsApproved(null);
        setLoading(false);
      }
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

      if (existing?.user) {
        lastCheckedUserId = existing.user.id;
        checkApproval(existing.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(clearSession);

    return () => {
      mounted = false;
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
