import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportBoundaryError, installGlobalErrorHandlers } from "../lib/error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { registerPWA } from "@/lib/pwa-register";
import { LanguageProvider, LANG_INIT, translate, type Lang } from "@/lib/i18n";

/** شاشات الجذر تُعرض خارج مزوّد اللغة، لذا نقرأ اللغة من المتصفح مباشرة */
function useRootLang(): Lang {
  const [lang, setLang] = useState<Lang>("ar");
  useEffect(() => {
    try {
      if (localStorage.getItem("lang") === "en") setLang("en");
    } catch {
      /* تجاهل */
    }
  }, []);
  return lang;
}

function NotFoundComponent() {
  const lang = useRootLang();
  const t = (k: string) => translate(lang, k);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("error.notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.notFound.desc")}</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{t("error.notFound.home")}</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const lang = useRootLang();
  const t = (k: string) => translate(lang, k);
  useEffect(() => { reportBoundaryError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("error.unexpected.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.unexpected.desc")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("common.retry")}</button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">{t("nav.home")}</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F5132" },
      { title: "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني" },
      { name: "description", content: "حاسبة العمال الذكية (SMART LABOR CALCULATOR): حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل." },
      { property: "og:title", content: "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني" },
      { property: "og:description", content: "حاسبة العمال الذكية (SMART LABOR CALCULATOR): حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني" },
      { name: "twitter:description", content: "حاسبة العمال الذكية (SMART LABOR CALCULATOR): حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Bv3INhi8duULh85MP9klkyYdpWc2/social-images/social-1781242033935-1000702556.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Bv3INhi8duULh85MP9klkyYdpWc2/social-images/social-1781242033935-1000702556.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap",
      },
    ],
    htmlAttrs: { lang: "ar", dir: "rtl" },
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const THEME_INIT = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_INIT }} />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Defer: route loaders/gates call Supabase auth, which deadlocks if invoked
      // synchronously inside this callback (the auth client lock is still held).
      setTimeout(() => {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }, 0);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        import("@/lib/audit.functions")
          .then(({ logAudit }) =>
            logAudit({ data: { action: event === "SIGNED_IN" ? "auth.login" : "auth.logout" } }).catch(() => {}),
          )
          .catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <PageViewTracker />
        <Outlet />
        <OfflineIndicator />
        <Toaster position="top-center" richColors />
      </LanguageProvider>
    </QueryClientProvider>
  );

}
