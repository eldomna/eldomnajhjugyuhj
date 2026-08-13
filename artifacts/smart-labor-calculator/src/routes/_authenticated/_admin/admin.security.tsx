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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/security")({
  component: SecurityPage,
});

const SECURITY_KEYS = [
  "security.password_min_length",
  "security.mfa_required",
  "security.session_timeout_min",
];

function SecurityPage() {
  const qc = useQueryClient();
  const [ipForm, setIpForm] = useState({ ip_value: "", rule_type: "blacklist", note: "" });

  const { data: settings } = useQuery({
    queryKey: ["admin", "security-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, setting_value, data_type, label")
        .in("setting_key", SECURITY_KEYS);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ipRules } = useQuery({
    queryKey: ["admin", "ip_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ip_rules")
        .select("id, ip_value, rule_type, note, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["admin", "security_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_alerts")
        .select("id, severity, alert_type, message, ip_address, resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logins } = useQuery({
    queryKey: ["admin", "login-monitoring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, ip_address, user_agent, created_at")
        .ilike("action", "%login%")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase.from("system_settings").update({ setting_value: value }).eq("setting_key", key);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    qc.invalidateQueries({ queryKey: ["admin", "security-settings"] });
  };

  const addIpRule = async () => {
    if (!ipForm.ip_value) return toast.error("أدخل عنوان IP");
    const { error } = await supabase.from("ip_rules").insert(ipForm);
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة القاعدة");
    setIpForm({ ...ipForm, ip_value: "", note: "" });
    qc.invalidateQueries({ queryKey: ["admin", "ip_rules"] });
  };

  const getSetting = (key: string) =>
    (settings ?? []).find((s) => s.setting_key === key)?.setting_value ?? "";

  return (
    <AdminShell
      permission="security.manage"
      title="مركز الأمان"
      description="سياسة كلمات المرور والمصادقة الثنائية والجلسات وقوائم IP وتنبيهات الأمان ومراقبة الدخول"
      icon={Lock}
    >
      <Tabs defaultValue="policy">
        <TabsList className="mb-4">
          <TabsTrigger value="policy">السياسات</TabsTrigger>
          <TabsTrigger value="ip">قوائم IP</TabsTrigger>
          <TabsTrigger value="alerts">تنبيهات الأمان</TabsTrigger>
          <TabsTrigger value="logins">مراقبة الدخول</TabsTrigger>
        </TabsList>

        <TabsContent value="policy">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-4">
              <Label className="text-xs">أقل طول لكلمة المرور</Label>
              <Input
                type="number"
                defaultValue={getSetting("security.password_min_length")}
                onBlur={(e) => saveSetting("security.password_min_length", e.target.value)}
              />
            </Card>
            <Card className="p-4">
              <Label className="text-xs">إلزام المصادقة الثنائية (MFA)</Label>
              <div className="mt-2">
                <Switch
                  checked={getSetting("security.mfa_required") === "true"}
                  onCheckedChange={(v) => saveSetting("security.mfa_required", String(v))}
                />
              </div>
            </Card>
            <Card className="p-4">
              <Label className="text-xs">مهلة الجلسة (دقيقة)</Label>
              <Input
                type="number"
                defaultValue={getSetting("security.session_timeout_min")}
                onBlur={(e) => saveSetting("security.session_timeout_min", e.target.value)}
              />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ip">
          <Card className="p-4 mb-4">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">عنوان IP</Label>
                <Input dir="ltr" value={ipForm.ip_value} onChange={(e) => setIpForm({ ...ipForm, ip_value: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">النوع</Label>
                <Select value={ipForm.rule_type} onValueChange={(v) => setIpForm({ ...ipForm, rule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whitelist">قائمة السماح</SelectItem>
                    <SelectItem value="blacklist">قائمة الحجب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ملاحظة</Label>
                <Input value={ipForm.note} onChange={(e) => setIpForm({ ...ipForm, note: e.target.value })} />
              </div>
              <Button onClick={addIpRule}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">IP</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">ملاحظة</th>
                  <th className="p-2 text-right">مفعّل</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(ipRules ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2" dir="ltr">{r.ip_value}</td>
                    <td className="p-2">
                      <Badge variant={r.rule_type === "whitelist" ? "outline" : "destructive"}>
                        {r.rule_type === "whitelist" ? "سماح" : "حجب"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">{r.note ?? "—"}</td>
                    <td className="p-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={async (v) => {
                          await supabase.from("ip_rules").update({ is_active: v }).eq("id", r.id);
                          qc.invalidateQueries({ queryKey: ["admin", "ip_rules"] });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase.from("ip_rules").delete().eq("id", r.id);
                          qc.invalidateQueries({ queryKey: ["admin", "ip_rules"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(ipRules ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد قواعد</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الخطورة</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الرسالة</th>
                  <th className="p-2 text-right">IP</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(alerts ?? []).map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">
                      <Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "outline"}>
                        {a.severity}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">{a.alert_type}</td>
                    <td className="p-2">{a.message}</td>
                    <td className="p-2 text-xs" dir="ltr">{a.ip_address ?? "—"}</td>
                    <td className="p-2 text-xs">{new Date(a.created_at).toLocaleString("ar-SA")}</td>
                    <td className="p-2">
                      {!a.resolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await supabase
                              .from("security_alerts")
                              .update({ resolved: true, resolved_at: new Date().toISOString() })
                              .eq("id", a.id);
                            qc.invalidateQueries({ queryKey: ["admin", "security_alerts"] });
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(alerts ?? []).length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد تنبيهات</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">العملية</th>
                  <th className="p-2 text-right">IP</th>
                  <th className="p-2 text-right">الجهاز</th>
                  <th className="p-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(logins ?? []).map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{l.action}</td>
                    <td className="p-2 text-xs" dir="ltr">{l.ip_address ?? "—"}</td>
                    <td className="p-2 text-xs truncate max-w-xs">{l.user_agent ?? "—"}</td>
                    <td className="p-2 text-xs">{new Date(l.created_at).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
                {(logins ?? []).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد سجلات دخول</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
