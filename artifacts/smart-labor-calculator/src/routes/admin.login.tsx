import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminSignIn,
  readAdminState,
  translateAdminAuthError,
} from "@/lib/admin/adminAuth";
import { ensureTempAdmin } from "@/lib/admin/bootstrap.functions";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دخول لوحة التحكم • حاسبة العمال الذكية" },
      { name: "description", content: "تسجيل دخول مدراء النظام إلى لوحة تحكم حاسبة العمال الذكية." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "دخول لوحة التحكم • حاسبة العمال الذكية" },
      { property: "og:description", content: "بوابة دخول محمية لمدراء النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prefill remembered email + make sure a first-run admin account exists.
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = localStorage.getItem("admin_remember_email");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
    void ensureTempAdmin().catch(() => null);
    void readAdminState().then((s) => {
      if (cancelled) return;
      if (s.isAdmin && s.mustChangePassword) navigate({ to: "/admin/change-password", replace: true });
      else if (s.isAdmin) navigate({ to: "/admin", replace: true });
      else setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("الرجاء إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }
    setLoading(true);
    const res = await adminSignIn(email, password, remember);
    if (!res.ok) {
      setLoading(false);
      setError(translateAdminAuthError(res.error.message));
      return;
    }
    const state = await readAdminState();
    setLoading(false);
    if (!state.isAdmin) {
      setError("هذا الحساب لا يملك صلاحية الوصول إلى لوحة التحكم.");
      return;
    }
    navigate({ to: state.mustChangePassword ? "/admin/change-password" : "/admin", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 mb-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">لوحة تحكم النظام</h1>
          <p className="text-sm text-muted-foreground mt-1">
            هذه البوابة مخصصة لمدراء النظام فقط
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">البريد الإلكتروني</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">كلمة المرور</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
                disabled={loading}
              />
              تذكّرني
            </label>
            <Link to="/reset-password" className="text-sm text-primary hover:underline">
              نسيت كلمة المرور؟
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading || checking}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ التحقق…
              </>
            ) : (
              "تسجيل الدخول"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            العودة إلى واجهة العميل
          </Link>
        </p>
      </Card>
    </div>
  );
}
