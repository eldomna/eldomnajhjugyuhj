import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي • حقوق العمال" }] }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setMobile(profile.mobile_number ?? "");
    }
  }, [profile]);

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({
      full_name: fullName, mobile_number: mobile,
    }).eq("id", user.id);
    if (error) return toast.error("فشل الحفظ");
    toast.success("تم تحديث الملف");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePwd = async () => {
    if (newPwd.length < 8) return toast.error("كلمة المرور قصيرة");
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) return toast.error(error.message);
    setNewPwd("");
    toast.success("تم تغيير كلمة المرور");
  };

  const deleteAccount = async () => {
    if (!confirm("حذف حسابك نهائياً؟ سيتم حذف جميع بياناتك.")) return;
    // Self-service deletion: sign out + cascade-delete profile rows; full auth.user deletion requires admin
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("تم تسجيل خروجك وحذف بياناتك");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold">الملف الشخصي</h1>

        <Card className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input value={user.email ?? ""} disabled dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الجوال</Label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" />
          </div>
          <Button onClick={saveProfile}>حفظ التغييرات</Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-bold">تغيير كلمة المرور</h2>
          <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="كلمة مرور جديدة" dir="ltr" />
          <Button variant="outline" onClick={changePwd}>تحديث كلمة المرور</Button>
        </Card>

        <Card className="p-5 border-destructive/40">
          <h2 className="font-bold text-destructive mb-2">منطقة الخطر</h2>
          <p className="text-sm text-muted-foreground mb-3">حذف بياناتك من المنصة وإنهاء الجلسة.</p>
          <Button variant="destructive" onClick={deleteAccount}>حذف الحساب</Button>
        </Card>
      </main>
    </div>
  );
}
