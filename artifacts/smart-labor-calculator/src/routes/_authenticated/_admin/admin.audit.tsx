import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, ShieldAlert, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/audit")({
  component: AuditPage,
});

type Row = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.logout": "تسجيل خروج",
  "document.generate_pdf": "إصدار PDF",
  "calculations.insert": "إنشاء حساب",
  "calculations.update": "تعديل حساب",
  "calculations.delete": "حذف حساب",
  "documents.insert": "إنشاء وثيقة",
  "documents.delete": "حذف وثيقة",
  "profiles.update": "تحديث ملف شخصي",
  "platform_settings.update": "تحديث إعدادات المنصة",
  "user_roles.insert": "منح صلاحية",
  "user_roles.delete": "إلغاء صلاحية",
};

function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", action, from, to],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, actor_id, action, target_type, target_id, ip_address, user_agent, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (action !== "all") q = q.eq("action", action);
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data ?? [];
    const s = search.toLowerCase();
    return (data ?? []).filter(
      (r) =>
        r.action.toLowerCase().includes(s) ||
        (r.target_id ?? "").toLowerCase().includes(s) ||
        (r.actor_id ?? "").toLowerCase().includes(s) ||
        (r.ip_address ?? "").toLowerCase().includes(s),
    );
  }, [data, search]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.action));
    return Array.from(set).sort();
  }, [data]);

  const exportCSV = () => {
    const rows = filtered;
    const header = ["التاريخ", "الإجراء", "النوع", "المعرّف", "المستخدم", "IP", "User-Agent"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        new Date(r.created_at).toISOString(),
        r.action,
        r.target_type ?? "",
        r.target_id ?? "",
        r.actor_id,
        r.ip_address ?? "",
        (r.user_agent ?? "").replace(/[",\n]/g, " "),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">سجل التدقيق</h1>
        </div>

        <Card className="p-4 mb-4">
          <div className="grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">بحث</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute right-2 top-2.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="إجراء، معرّف، IP..."
                  className="pr-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">الإجراء</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">من</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">إلى</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={exportCSV} variant="outline" className="gap-2" disabled={!filtered.length}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Button>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-start p-3">التاريخ</th>
                  <th className="text-start p-3">الإجراء</th>
                  <th className="text-start p-3">الهدف</th>
                  <th className="text-start p-3">المستخدم</th>
                  <th className="text-start p-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">جاري التحميل…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap tabular-nums text-xs">
                      {new Date(r.created_at).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {ACTION_LABELS[r.action] ?? r.action}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {r.target_type && <span className="text-muted-foreground">{r.target_type}/</span>}
                      {r.target_id ?? "—"}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {r.actor_id.slice(0, 8)}…
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{r.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground mt-3">يعرض آخر 1000 سجل ضمن الفلاتر المحددة.</p>
      </main>
    </div>
  );
}
