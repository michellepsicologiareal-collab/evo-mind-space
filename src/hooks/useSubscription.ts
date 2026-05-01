import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = "free" | "pending" | "active";

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      setStatus((data?.subscription_status as SubscriptionStatus) ?? "free");
      setLoading(false);
    };

    fetch();
  }, [user]);

  return { status, isPremium: status === "active", loading };
}
