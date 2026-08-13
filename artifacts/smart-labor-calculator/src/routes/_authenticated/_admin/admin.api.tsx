import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/api")({
  component: ApiPage,
});

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ApiPage() {
  const qc = useQueryClient();
  const [keyForm, setKeyForm] = useState({ name: "", scopes: "cases.view,report.view", rate: 60 });
  const [hookForm, setHookForm] = useState({ name: "", url: "", events: "case.created,report.generated" });

  const { data: keys } = useQuery({
    queryKey: ["admin", "api_keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, scopes, rate_limit_per_min, is_active, last_used_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hooks } = useQuery({
    queryKey: ["admin", "webhook_endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("id, name, url, events, is_active, last_status, last_delivery_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: usage } = useQuery({
    queryKey: ["admin", "api_usage_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_usage_logs")
        .select("id, endpoint, method, status_code, response_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const createKey = async () => {
    if (!keyForm.name) return toast.error("أدخل اسم المفتاح");
    const raw = `slk_${crypto.randomUUID().replace(/-/g, "")}`;
    const hash = await sha256(raw);
    const { error } = await supabase.from("api_keys").insert({
      name: keyForm.name,
      key_prefix: raw.slice(0, 12),
      key_hash: hash,
      scopes: keyForm.scopes.split(",").map((s) => s.trim()).filter(Boolean),
      rate_limit_per_min: Number(keyForm.rate) || 60,
    });
    if (error) return toast.error(error.message);
    await navigator.clipboard.writeText(raw).catch(() => undefined);
    toast.success("تم إنشاء المفتاح ونسخه — لن يُعرض مرة أخرى");
    setKeyForm({ ...keyForm, name: "" });
    qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
  };

  const createHook = async () => {
    if (!hookForm.name || !hookForm.url) return toast.error("أدخل الاسم والرابط");
    const { error } = await supabase.from("webhook_endpoints").insert({
      name: hookForm.name,
      url: hookForm.url,
      events: hookForm.events.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة Webhook");
    setHookForm({ ...hookForm, name: "", url: "" });
    qc.invalidateQueries({ queryKey: ["admin", "webhook_endpoints"] });
  };

  return (
    <AdminShell
      permission="api.manage"
      title="إدارة واجهات API"
      description="مفاتيح API والنطاقات وحدود المعدل وWebhooks وسجلات الاستخدام"
      icon={Plug}
    >
      <Tabs defaultValue="keys">
        <TabsList className="mb-4">
          <TabsTrigger value="keys">مفاتيح API</TabsTrigger>
          <TabsTrigger value="hooks">Webhooks</TabsTrigger>
          <TabsTrigger value="usage">سجلات الاستخدام</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <Card className="p-4 mb-4">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">اسم المفتاح</Label>
                <Input value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">النطاقات (مفصولة بفاصلة)</Label>
                <Input value={keyForm.scopes} onChange={(e) => setKeyForm({ ...keyForm, scopes: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">حد المعدل / دقيقة</Label>
                <Input
                  type="number"
                  value={keyForm.rate}
                  onChange={(e) => setKeyForm({ ...keyForm, rate: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={createKey}><Plus className="h-4 w-4 ml-1" /> إنشاء مفتاح</Button>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Copy className="h-3 w-3" /> يُنسخ المفتاح تلقائياً عند الإنشاء ولا يُخزَّن إلا بصمته المشفّرة.
            </p>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">البادئة</th>
                  <th className="p-2 text-right">النطاقات</th>
                  <th className="p-2 text-right">الحد</th>
                  <th className="p-2 text-right">مفعّل</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(keys ?? []).map((k) => (
                  <tr key={k.id} className="border-t">
                    <td className="p-2">{k.name}</td>
                    <td className="p-2"><code className="text-xs">{k.key_prefix}…</code></td>
                    <td className="p-2 text-xs">{(k.scopes ?? []).join(", ")}</td>
                    <td className="p-2">{k.rate_limit_per_min}</td>
                    <td className="p-2">
                      <Switch
                        checked={k.is_active}
                        onCheckedChange={async (v) => {
                          await supabase.from("api_keys").update({ is_active: v }).eq("id", k.id);
                          qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase.from("api_keys").delete().eq("id", k.id);
                          qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(keys ?? []).length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد مفاتيح</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="hooks">
          <Card className="p-4 mb-4">
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={hookForm.name} onChange={(e) => setHookForm({ ...hookForm, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الرابط</Label>
                <Input dir="ltr" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الأحداث</Label>
                <Input value={hookForm.events} onChange={(e) => setHookForm({ ...hookForm, events: e.target.value })} />
              </div>
            </div>
            <Button className="mt-3" onClick={createHook}><Plus className="h-4 w-4 ml-1" /> إضافة Webhook</Button>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">الرابط</th>
                  <th className="p-2 text-right">الأحداث</th>
                  <th className="p-2 text-right">آخر حالة</th>
                  <th className="p-2 text-right">مفعّل</th>
                </tr>
              </thead>
              <tbody>
                {(hooks ?? []).map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-2">{h.name}</td>
                    <td className="p-2 text-xs" dir="ltr">{h.url}</td>
                    <td className="p-2 text-xs">{(h.events ?? []).join(", ")}</td>
                    <td className="p-2">{h.last_status ?? "—"}</td>
                    <td className="p-2">
                      <Switch
                        checked={h.is_active}
                        onCheckedChange={async (v) => {
                          await supabase.from("webhook_endpoints").update({ is_active: v }).eq("id", h.id);
                          qc.invalidateQueries({ queryKey: ["admin", "webhook_endpoints"] });
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {(hooks ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد Webhooks</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <div className="flex gap-2 mb-3">
            <Badge variant="outline">عدد الطلبات: {usage?.length ?? 0}</Badge>
            <Badge variant="outline">
              متوسط الاستجابة:{" "}
              {usage && usage.length
                ? Math.round(usage.reduce((s, u) => s + (u.response_ms ?? 0), 0) / usage.length)
                : 0}{" "}
              مل.ث
            </Badge>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">المسار</th>
                  <th className="p-2 text-right">الطريقة</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">الزمن</th>
                  <th className="p-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(usage ?? []).map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2 text-xs" dir="ltr">{u.endpoint}</td>
                    <td className="p-2">{u.method}</td>
                    <td className="p-2">{u.status_code ?? "—"}</td>
                    <td className="p-2">{u.response_ms ?? 0} مل.ث</td>
                    <td className="p-2 text-xs">{new Date(u.created_at).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
                {(usage ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
