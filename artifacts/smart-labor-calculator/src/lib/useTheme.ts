import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

/**
 * Theme toggle with persistence:
 * - localStorage for instant, offline-safe restore (used by the inline boot script)
 * - profiles.theme_preference so the choice follows the account across devices/sessions
 */
export function useTheme() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  // Initial resolve (local first — never blocks paint)
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const initial: ThemeMode = stored === "dark" || stored === "light" ? stored : systemPrefersDark() ? "dark" : "light";
    setDark(initial === "dark");
    applyTheme(initial);
    setReady(true);
  }, []);

  // Account preference wins once the session is known
  useEffect(() => {
    let cancelled = false;

    const syncFromAccount = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const { data } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", userData.user.id)
          .maybeSingle();
        const pref = (data as { theme_preference?: string | null } | null)?.theme_preference;
        if (cancelled || !pref || pref === "system") return;
        const mode: ThemeMode = pref === "dark" ? "dark" : "light";
        setDark(mode === "dark");
        applyTheme(mode);
        try {
          localStorage.setItem(STORAGE_KEY, mode);
        } catch {
          /* ignore */
        }
      } catch {
        /* offline or not signed in — keep local preference */
      }
    };

    void syncFromAccount();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Defer: calling Supabase auth inside the callback deadlocks the auth lock.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => void syncFromAccount(), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const toggle = useCallback(async () => {
    const next: ThemeMode = dark ? "light" : "dark";
    setDark(next === "dark");
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await supabase.from("profiles").update({ theme_preference: next }).eq("id", userData.user.id);
    } catch {
      /* preference stays local if the save fails */
    }
  }, [dark]);

  return { dark, ready, toggle };
}
