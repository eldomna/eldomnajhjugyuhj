import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "إعادة تعيين كلمة المرور" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-parses the recovery hash and emits PASSWORD_RECOVERY
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("كلمة المرور قصيرة (8 أحرف على الأقل)");
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold mb-1">إعادة تعيين كلمة المرور</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready ? "اكتب كلمة المرور الجديدة" : "افتح هذه الصفحة من رابط الاستعادة في بريدك الإلكتروني."}
        </p>
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="np">كلمة المرور الجديدة</Label>
              <Input id="np" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">تأكيد كلمة المرور</Label>
              <Input id="cp" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "تحديث"}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
