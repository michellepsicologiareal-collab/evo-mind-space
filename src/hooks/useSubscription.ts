import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_KIWIFY_URL,
  FREE_PLAN_NAME,
  type SubscriptionStatus,
} from "@/lib/subscription";

export type { SubscriptionStatus };
export type ProfileType = "standard" | "supervisee" | "supervisor";

export interface PlanInfo {
  planName: string;
  startedAt: string | null;
  lastPaymentAt: string | null;
  nextRenewalAt: string | null;
  notes: string | null;
}

const EMPTY_PLAN: PlanInfo = {
  planName: FREE_PLAN_NAME,
  startedAt: null,
  lastPaymentAt: null,
  nextRenewalAt: null,
  notes: null,
};

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("free");
  const [profileType, setProfileType] = useState<ProfileType>("standard");
  const [plan, setPlan] = useState<PlanInfo>(EMPTY_PLAN);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "subscription_status, profile_type, plan_name, subscription_started_at, last_payment_at, next_renewal_at, subscription_notes",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

      const p = profile as any;
      setStatus((p?.subscription_status as SubscriptionStatus) ?? "free");
      setProfileType((p?.profile_type as ProfileType) ?? "standard");
      setPlan({
        planName: p?.plan_name || FREE_PLAN_NAME,
        startedAt: p?.subscription_started_at ?? null,
        lastPaymentAt: p?.last_payment_at ?? null,
        nextRenewalAt: p?.next_renewal_at ?? null,
        notes: p?.subscription_notes ?? null,
      });
      setIsAdmin(!!role);
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return {
    status,
    isPremium: status === "active",
    profileType,
    plan,
    isAdmin,
    loading,
  };
}

/** Link de checkout da Kiwify, configurável pelo painel administrativo. */
export function useKiwifyLink() {
  const [url, setUrl] = useState<string>(DEFAULT_KIWIFY_URL);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "kiwify_checkout_url")
      .maybeSingle();
    if (data?.value) setUrl(data.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { url, loading, reload: load };
}
