import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Trash2, Power, PowerOff, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/admin-users")({
  component: AdminUsersPage,
});

type Row = {
  id: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  created_at: string;
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["admin", "admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, email, role, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase
        .from("admin_users")
        .insert({ email: e.trim().toLowerCase(), status: "active", role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المسؤول");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("admin_users")
        .update({ status: row.status === "active" ? "inactive" : "active" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["admin", "admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["admin", "admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">إدارة صلاحيات الأدمن</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          أضف أو احذف بريد إلكتروني للسماح بدخول لوحة الإدارة عبر تسجيل دخول Google فقط. لا تُمنح
          صلاحية الأدمن إلا إذا كان البريد موجوداً هنا وحالته نشطة.
        </p>

        <Card className="p-5 mb-6">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => email && addMut.mutate(email)}
              disabled={!email || addMut.isPending}
            >
              <UserPlus className="h-4 w-4 ml-2" /> إضافة مسؤول
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            عند إضافة بريد، يتم منح صلاحية الأدمن تلقائياً إذا كان لدى المستخدم حساب مسجل بنفس
            البريد.
          </p>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-3">البريد</th>
                <th className="text-right p-3">الدور</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3">أُضيف في</th>
                <th className="text-right p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
              )}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا يوجد مسؤولون.</td></tr>
              )}
              {data?.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3" dir="ltr">{r.email}</td>
                  <td className="p-3">{r.role}</td>
                  <td className="p-3">
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status === "active" ? "نشط" : "موقوف"}
                    </Badge>
                  </td>
                  <td className="p-3">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                  <td className="p-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleMut.mutate(r)}>
                      {r.status === "active" ? (
                        <><PowerOff className="h-3.5 w-3.5 ml-1" /> إيقاف</>
                      ) : (
                        <><Power className="h-3.5 w-3.5 ml-1" /> تفعيل</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`حذف ${r.email} من قائمة المسؤولين؟`)) removeMut.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
