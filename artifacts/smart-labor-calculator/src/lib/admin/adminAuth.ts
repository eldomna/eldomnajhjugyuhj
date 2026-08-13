/**
 * Admin authentication logic — fully decoupled from UI.
 * The client app keeps using its own /auth flow; this module powers /admin/* only.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";


// The generated Supabase types lag behind fresh RPCs/columns; keep the casts local.
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export const TEMP_ADMIN_EMAIL = "admin@example.com";

export type AdminSession = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
};

export const STRONG_PASSWORD_RULES = [
  { label: "8 أحرف على الأقل", test: (v: string) => v.length >= 8 },
  { label: "حرف كبير (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "حرف صغير (a-z)", test: (v: string) => /[a-z]/.test(v) },
  { label: "رقم (0-9)", test: (v: string) => /[0-9]/.test(v) },
  { label: "رمز خاص (!@#$…)", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function isStrongPassword(value: string) {
  return STRONG_PASSWORD_RULES.every((r) => r.test(value));
}

export async function readAdminState(): Promise<Omit<AdminSession, "loading">> {
  const empty = { userId: null, email: null, isAdmin: false, mustChangePassword: false };
  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = userData?.user;
  if (!user) return empty;

  const [{ data: roleRow }, mustChange] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle(),
    db.rpc("must_change_password").then((r) => r.data === true).catch(() => false),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    isAdmin: !!roleRow,
    mustChangePassword: mustChange,
  };
}

export async function adminSignIn(email: string, password: string, remember: boolean) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false as const, error };
  try {
    if (remember) localStorage.setItem("admin_remember_email", email.trim());
    else localStorage.removeItem("admin_remember_email");
  } catch {
    /* storage unavailable */
  }
  return { ok: true as const, userId: data.user?.id ?? null };
}

export async function adminChangePassword(currentPassword: string, newPassword: string) {
  // Root cause of the earlier 400s: the current password was verified with
  // `signInWithPassword` on the SAME client. That call rotates the stored
  // session (new refresh token) while the auth lock is still held, so the
  // follow-up `updateUser` ran against a refresh token the server had already
  // revoked → 400 from /auth/v1/user. Verification now happens on a throwaway
  // client that persists nothing, leaving the real session untouched.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;
  const email = session?.user?.email;
  if (sessionError || !session || !email) {
    return { ok: false as const, message: "الجلسة منتهية، الرجاء تسجيل الدخول مجدداً." };
  }

  const verifier = createClient(
    import.meta.env['VITE_SUPABASE_URL'] as string,
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: undefined } },
  );
  const verify = await verifier.auth.signInWithPassword({ email, password: currentPassword });
  await verifier.auth.signOut({ scope: "local" }).catch(() => null);
  if (verify.error) {
    const raw = verify.error.message || "";
    if (/rate limit|too many/i.test(raw)) {
      return { ok: false as const, message: "محاولات كثيرة، حاول بعد قليل." };
    }
    return { ok: false as const, message: "كلمة المرور الحالية غير صحيحة." };
  }

  const update = await supabase.auth.updateUser({ password: newPassword });
  if (update.error) {
    const raw = update.error.message || "";
    const weak = /weak|breach|pwned|different from the old|should be different/i.test(raw);
    return {
      ok: false as const,
      message: weak
        ? "كلمة المرور مرفوضة: اختر كلمة مرور أقوى وغير مستخدمة سابقاً."
        : "تعذّر تحديث كلمة المرور: " + raw,
    };
  }

  const cleared = await db.rpc("clear_must_change_password");
  if (cleared.error) {
    return { ok: false as const, message: "تم تحديث كلمة المرور لكن تعذّر إكمال التهيئة، حدّث الصفحة." };
  }
  return { ok: true as const };
}






export async function adminSignOut() {
  await supabase.auth.signOut().catch(() => null);
}

export function translateAdminAuthError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد البريد الإلكتروني بعد.";
  if (m.includes("rate limit") || m.includes("too many")) return "محاولات كثيرة، حاول بعد قليل.";
  if (m.includes("failed to fetch") || m.includes("network")) return "تعذّر الاتصال بالخدمة، تحقق من الإنترنت.";
  return message || "حدث خطأ غير متوقع.";
}

/** Reactive admin session state for UI components. */
export function useAdminSession(): AdminSession & { refresh: () => void } {
  const [state, setState] = useState<AdminSession>({
    loading: true,
    userId: null,
    email: null,
    isAdmin: false,
    mustChangePassword: false,
  });

  const load = useCallback(async () => {
    const next = await readAdminState();
    setState({ loading: false, ...next });
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Defer: calling Supabase auth inside the callback deadlocks the auth lock.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(() => void load(), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return { ...state, refresh: () => void load() };
}
