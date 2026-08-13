import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  try {
    let sid = localStorage.getItem("ylr_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("ylr_sid", sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;
    const sid = getSessionId();
    supabase.auth.getUser()
      .then(({ data }) => {
        if (!navigator.onLine) return;
        return supabase
          .from("page_views")
          .insert({
            path: pathname,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent.slice(0, 500),
            user_id: data.user?.id ?? null,
            session_id: sid,
          });
      })
      .catch(() => {});
  }, [pathname]);

  return null;
}
