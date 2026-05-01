import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = "free" | "pending" | "active";
export type ProfileType = "standard" | "supervisee" | "supervisor";

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("free");
  const [profileType, setProfileType] = useState<ProfileType>("standard");
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
          .select("subscription_status, profile_type")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

      setStatus((profile?.subscription_status as SubscriptionStatus) ?? "free");
      setProfileType((profile?.profile_type as ProfileType) ?? "standard");
      setIsAdmin(!!role);
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return { status, isPremium: status === "active", profileType, isAdmin, loading };
}
