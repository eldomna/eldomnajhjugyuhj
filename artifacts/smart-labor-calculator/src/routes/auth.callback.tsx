import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginDestination } from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "إتمام تسجيل الدخول — حاسبة العمال الذكية" },
      {
        name: "description",
        content: "صفحة إتمام تسجيل الدخول عبر مزودي الهوية في حاسبة العمال الذكية.",
      },
      { property: "og:title", content: "إتمام تسجيل الدخول — حاسبة العمال الذكية" },
      {
        property: "og:description",
        content: "صفحة إتمام تسجيل الدخول عبر مزودي الهوية في حاسبة العمال الذكية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // بعد أي تسجيل دخول OAuth: لو اليوزر عنده دولة محفوظة مسبقاً (profiles.country)
    // يودّيه لحاسبته مباشرة، وإلا يعرض عليه شاشة اختيار الدولة — نفس منطق الدخول العادي.
    const goAfterLogin = async () => {
      if (cancelled) return;
      const destination = await resolvePostLoginDestination();
      if (cancelled) return;
      navigate({ to: destination as never, replace: true });
    };

    const finish = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setError("تعذّر إكمال تسجيل الدخول، حاول مرة أخرى.");
        return;
      }
      if (data.session) {
        await goAfterLogin();
        return;
      }
      // The SDK may still be exchanging the code in the URL.
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          setTimeout(() => void goAfterLogin(), 0);
        }
      });
      setTimeout(() => {
        if (!cancelled) setError("انتهت صلاحية رابط تسجيل الدخول، أعد المحاولة.");
      }, 8000);
      return () => sub.subscription.unsubscribe();
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">
          {error ? "تعذّر تسجيل الدخول" : "جارٍ إكمال تسجيل الدخول…"}
        </h1>
        {error ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <a
              href="/auth"
              className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              العودة لصفحة الدخول
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
