import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronLeft,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserCircle2,
  X,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/useTheme";
import { ADMIN_GROUPS, ADMIN_MODULES, findAdminModule } from "@/components/admin/adminModules";
import { adminSignOut, useAdminSession } from "@/lib/admin/adminAuth";
import { useAdminPermissions } from "@/lib/admin/permissions";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/lib/admin/dashboard";

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

function SidebarNav({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const q = query.trim().toLowerCase();
  const { can } = useAdminPermissions();
  return (
    <nav className="space-y-4">
      {ADMIN_GROUPS.map((group) => {
        const items = ADMIN_MODULES.filter(
          (m) => m.group === group && can(m.permission) && (!q || m.label.toLowerCase().includes(q)),
        );
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  onClick={onNavigate}
                  activeOptions={{ exact: m.to === "/admin" }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
                >
                  <m.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const { data } = useQuery({
    queryKey: ["admin", "topbar-notifications"],
    queryFn: fetchDashboardData,
    staleTime: 60_000,
  });
  const items = data?.notifications ?? [];
  const unread = items.filter((n) => n.unread).length;

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label="الإشعارات" onClick={() => setOpen((v) => !v)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 end-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
        )}
      </Button>
      {open && (
        <div className="absolute end-0 mt-2 w-72 rounded-lg border bg-popover p-2 shadow-lg z-50">
          <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">الإشعارات</p>
          {items.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">لا توجد إشعارات</p>
          )}
          {items.map((n) => (
            <div key={n.id} className="rounded-md p-2 text-sm hover:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{n.title}</span>
                {n.unread && <Badge variant="secondary" className="text-[10px]">جديد</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{n.body}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{n.at}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const { email } = useAdminSession();
  const router = useRouter();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await adminSignOut();
    router.navigate({ to: "/admin/login", replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label="حساب المدير" onClick={() => setOpen((v) => !v)}>
        <UserCircle2 className="h-5 w-5" />
      </Button>
      {open && (
        <div className="absolute end-0 mt-2 w-60 rounded-lg border bg-popover p-2 shadow-lg z-50">
          <div className="px-2 py-1.5">
            <p className="text-sm font-semibold truncate">{email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">مدير النظام</p>
          </div>
          <div className="h-px bg-border my-1" />
          <Link
            to="/admin/change-password"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <ShieldCheck className="h-4 w-4" /> تغيير كلمة المرور
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-4 w-4" /> واجهة العميل
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = findAdminModule(pathname);
  return (
    <nav aria-label="مسار التنقل" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/admin" className="hover:text-foreground">لوحة التحكم</Link>
      {current && current.to !== "/admin" && (
        <>
          <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
          <span className="text-foreground font-medium truncate">{current.label}</span>
        </>
      )}
    </nav>
  );
}

/**
 * Admin-only chrome. Deliberately shares nothing with the client-facing
 * AppHeader/Footer: sidebar, topbar, breadcrumbs, search, notifications,
 * profile menu and dark mode live here.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen border-e bg-card">
          <div className="flex items-center gap-2 px-4 h-14 border-b">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm truncate">لوحة تحكم النظام</span>
          </div>
          <div className="p-3 overflow-y-auto flex-1">
            <SidebarNav query={query} />
          </div>
        </aside>

        <div className="min-w-0 flex flex-col min-h-screen">
          {/* Top navigation bar */}
          <header className="sticky top-0 z-40 h-14 border-b bg-card/95 backdrop-blur">
            <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="القائمة"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="hidden sm:block">
                  <Breadcrumbs />
                </div>
              </div>

              <div className="relative min-w-0">
                <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث في الوحدات…"
                  className="ps-8 h-9"
                  aria-label="بحث"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" aria-label="تبديل الوضع الليلي" onClick={toggle}>
                  {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <NotificationsMenu />
                <ProfileMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
        </div>
      </div>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-card h-full overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm">لوحة تحكم النظام</span>
              <Button variant="ghost" size="icon" aria-label="إغلاق" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarNav query={query} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between")}>
      <div className="flex min-w-0 items-start gap-2">
        {Icon ? <Icon className="h-6 w-6 shrink-0 text-primary mt-0.5" /> : null}
        <div className="min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-bold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
        </div>
      </div>
      {actions}
    </div>
  );
}
