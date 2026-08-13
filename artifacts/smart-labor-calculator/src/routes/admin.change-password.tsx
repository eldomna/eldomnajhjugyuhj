import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, KeyRound, AlertCircle, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  STRONG_PASSWORD_RULES,
  adminChangePassword,
  isStrongPassword,
  readAdminState,
} from "@/lib/admin/adminAuth";

export const Route = createFileRoute("/admin/change-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تغيير كلمة المرور • لوحة التحكم" },
      { name: "description", content: "تعيين كلمة مرور قوية لحساب مدير النظام قبل الدخول إلى لوحة التحكم." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "تغيير كلمة المرور • لوحة التحكم" },
      { property: "og:description", content: "تأمين حساب المدير بكلمة مرور قوية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminChangePasswordPage,
});

function AdminChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readAdminState().then((s) => {
      if (cancelled) return;
      if (!s.userId || !s.isAdmin) navigate({ to: "/admin/login", replace: true });
      // Initial setup already done → never show this page again.
      else if (!s.mustChangePassword) navigate({ to: "/admin", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isStrongPassword(next)) {
      setError("كلمة المرور الجديدة لا تستوفي سياسة الأمان.");
      return;
    }
    if (next !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (next === current) {
      setError("كلمة المرور الجديدة يجب أن تختلف عن الحالية.");
      return;
    }
    setLoading(true);
    const res = await adminChangePassword(current, next);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success("تم تحديث كلمة المرور بنجاح");
    navigate({ to: "/admin", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 mb-3">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">تغيير كلمة المرور</h1>
          <p className="text-sm text-muted-foreground mt-1">
            يجب تعيين كلمة مرور قوية قبل الدخول إلى لوحة التحكم
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
            <Label htmlFor="cur-pw">كلمة المرور الحالية</Label>
            <Input
              id="cur-pw"
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pw">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={show ? "text" : "password"}
                dir="ltr"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
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

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">تأكيد كلمة المرور</Label>
            <Input
              id="confirm-pw"
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>

          <ul className="space-y-1 rounded-md bg-muted/50 p-3">
            {STRONG_PASSWORD_RULES.map((r) => {
              const ok = r.test(next);
              return (
                <li
                  key={r.label}
                  className={`flex items-center gap-2 text-xs ${ok ? "text-primary" : "text-muted-foreground"}`}
                >
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {r.label}
                </li>
              );
            })}
          </ul>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ الحفظ…
              </>
            ) : (
              "حفظ كلمة المرور"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
