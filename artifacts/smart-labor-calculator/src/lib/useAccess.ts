import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccessState = {
  loading: boolean;
  signedIn: boolean;
  isSubscribed: boolean;
  expiresAt: string | null;
  trialUsed: number;
  trialLimit: number;
};

const initial: AccessState = {
  loading: true,
  signedIn: false,
  isSubscribed: false,
  expiresAt: null,
  trialUsed: 0,
  trialLimit: 1,
};

/** حالة وصول المستخدم: اشتراك فعّال أو تجربة مجانية واحدة لكل رقم جوال. */
export function useAccess() {
  const [state, setState] = useState<AccessState>(initial);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setState({ ...initial, loading: false });
        return;
      }
      const { data, error } = await supabase.rpc("get_access_status");
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setState({ ...initial, loading: false, signedIn: true });
        return;
      }
      setState({
        loading: false,
        signedIn: true,
        isSubscribed: !!row.is_subscribed,
        expiresAt: row.expires_at ?? null,
        trialUsed: row.trial_used ?? 0,
        trialLimit: row.trial_limit ?? 1,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Defer: calling Supabase auth inside the callback deadlocks the auth lock.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(() => refresh(), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...state, refresh };
}

/** استهلاك التجربة المجانية (مرة واحدة لكل رقم جوال). */
export async function consumeFreeTrial(): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_free_trial");
  if (error) return false;
  return !!data;
}
