import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ToggleLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/features")({
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ flag_key: "", description: "", country_code: "", plan_code: "" });

  const { data: flags } = useQuery({
    queryKey: ["admin", "feature_flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("id, flag_key, description, enabled, country_code, plan_code, created_at")
        .order("flag_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "feature_flags"] });

  const addFlag = async () => {
    if (!form.flag_key) return toast.error("أدخل مفتاح الميزة");
    const { error } = await supabase.from("feature_flags").insert({
      flag_key: form.flag_key,
      description: form.description || null,
      country_code: form.country_code || null,
      plan_code: form.plan_code || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة المفتاح");
    setForm({ flag_key: "", description: "", country_code: "", plan_code: "" });
    invalidate();
  };

  return (
    <AdminShell
      permission="features.manage"
      title="مفاتيح الميزات"
      description="تفعيل أو تعطيل الميزات حسب الدولة أو الخطة دون إعادة نشر النظام"
      icon={ToggleLeft}
    >
      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">المفتاح</Label>
            <Input value={form.flag_key} onChange={(e) => setForm({ ...form, flag_key: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">الوصف</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">الدولة (اختياري)</Label>
            <Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">الخطة (اختياري)</Label>
            <Input value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })} />
          </div>
        </div>
        <Button className="mt-3" onClick={addFlag}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="p-2 text-right">المفتاح</th>
              <th className="p-2 text-right">الوصف</th>
              <th className="p-2 text-right">النطاق</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(flags ?? []).map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-2"><code className="text-xs">{f.flag_key}</code></td>
                <td className="p-2 text-xs">{f.description ?? "—"}</td>
                <td className="p-2 text-xs">
                  {f.country_code || f.plan_code ? (
                    <Badge variant="outline">
                      {[f.country_code, f.plan_code].filter(Boolean).join(" / ")}
                    </Badge>
                  ) : (
                    "عام"
                  )}
                </td>
                <td className="p-2">
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={async (v) => {
                      await supabase.from("feature_flags").update({ enabled: v }).eq("id", f.id);
                      invalidate();
                    }}
                  />
                </td>
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await supabase.from("feature_flags").delete().eq("id", f.id);
                      invalidate();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(flags ?? []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد مفاتيح</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
