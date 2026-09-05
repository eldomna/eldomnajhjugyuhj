import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { footerSealUrl as logoAssetUrl } from "@/assets/footer-seal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useTheme } from "@/lib/useTheme";
import { useI18n } from "@/lib/i18n";



export function AppHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<null | { email: string | null }>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { dark, toggle: toggleTheme } = useTheme();
  const { t, lang, toggle: toggleLang } = useI18n();

  useEffect(() => {
    if (navigator.onLine) {
      supabase.auth.getUser()
        .then(({ data }) => setUser(data.user ? { email: data.user.email ?? null } : null))
        .catch(() => setUser(null));
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ? { email: session.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const navLinks = (
    <>
      <Link to="/" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.home")}</Link>
      <Link to="/calculator" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.calculator")}</Link>
      <Link to="/subscribe" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.subscribe")}</Link>
      {user && (
        <>
          <Link to="/dashboard" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.dashboard")}</Link>
          <Link to="/calculations" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.calculations")}</Link>
          <Link to="/my-subscription" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.mySubscription")}</Link>
          <Link to="/referrals" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.referrals")}</Link>



          {isAdmin && (
            <Link to="/admin" className="text-primary font-semibold hover:opacity-80 transition-opacity" onClick={() => setOpen(false)}>{t("nav.admin")}</Link>
          )}
        </>
      )}
      <Link to="/support" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.support")}</Link>
      <Link to="/privacy" className="hover:text-primary transition-colors" onClick={() => setOpen(false)}>{t("nav.privacy")}</Link>

    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="h-0.5 w-full gold-rule opacity-70" />
      <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 md:flex md:h-16 md:justify-between md:py-0">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 font-display">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground/[0.04] ring-1 ring-accent/30">
            <img src={logoAssetUrl} alt="شعار حاسبة العمال الذكية" className="h-9 w-9 object-contain" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold">{t("brand.name")}</div>
            <div className="truncate text-[10px] tracking-wide text-muted-foreground">SMART LABOR CALCULATOR • SA / YE</div>
          </div>

        </Link>


        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">{navLinks}</nav>

        <div className="flex items-center gap-2">

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLang}
            aria-label="Switch language"
            className="px-2 text-xs font-bold"
          >
            {lang === "ar" ? "EN" : "AR"}
          </Button>
          <NotificationsBell />

          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="theme">

            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("nav.login")}</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background">
          <nav className="container mx-auto flex flex-col gap-3 px-4 py-4 text-sm">{navLinks}
            {!user && <Button asChild size="sm" className="mt-1"><Link to="/auth">{t("nav.login")}</Link></Button>}
          </nav>
        </div>
      )}
    </header>
  );
}
