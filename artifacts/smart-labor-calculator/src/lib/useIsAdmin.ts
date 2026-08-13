import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>({
    loading: true,
    isAdmin: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!navigator.onLine) {
        if (!cancelled) setState({ loading: false, isAdmin: false });
        return;
      }
      const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (!userData.user) {
        if (!cancelled) setState({ loading: false, isAdmin: false });
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState({ loading: false, isAdmin: !error && !!data });
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Defer: calling Supabase auth inside the callback deadlocks the auth lock.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(() => check(), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
