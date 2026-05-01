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

const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error("Tempo esgotado ao validar acesso.")), ms)
    ),
  ]);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  const checkApproval = async (userId: string) => {
    try {
      const { data: ensuredProfile, error: ensureError } = await withTimeout(
        (supabase as any).rpc("ensure_current_profile")
      );

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
      );

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

  useEffect(() => {
    let mounted = true;

    const clearSession = () => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setIsApproved(null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
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
        console.warn("Sessão salva inválida; limpando para novo login:", error.message);
        supabase.auth.signOut({ scope: "local" }).finally(clearSession);
        return;
      }

      if (!mounted) return;
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
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
