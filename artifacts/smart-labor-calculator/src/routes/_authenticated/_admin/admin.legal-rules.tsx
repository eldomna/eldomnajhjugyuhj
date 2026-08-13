import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, Plus, Download, Upload, GitCompare, CheckCircle2, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/legal-rules")({
  component: LegalRulesPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  scheduled: "مجدولة",
  active: "نشطة",
  disabled: "معطّلة",
};

function LegalRulesPage() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("SA");
  const [form, setForm] = useState({
    rule_key: "",
    version: "",
    title: "",
    effective_from: "",
    value: "{}",
    notes: "",
  });
  const [compare, setCompare] = useState<{ a: string; b: string }>({ a: "", b: "" });

  const { data: countries } = useQuery({
    queryKey: ["admin", "countries-lite"],
    queryFn: async () =>
      (await supabase.from("countries").select("code, name_ar").order("sort_order")).data ?? [],
  });

  const { data: rules } = useQuery({
    queryKey: ["admin", "legal_rule_versions", country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_rule_versions")
        .select("id, country_code, rule_key, version, title, value, effective_from, effective_to, status, notes, created_at")
        .eq("country_code", country)
        .order("rule_key")
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "legal_rule_versions"] });

  const addRule = async () => {
    if (!form.rule_key || !form.version) return toast.error("أدخل مفتاح القانون ورقم النسخة");
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(form.value || "{}");
    } catch {
      return toast.error("قيمة JSON غير صحيحة");
    }
    const { error } = await supabase.from("legal_rule_versions").insert({
      country_code: country,
      rule_key: form.rule_key,
      version: form.version,
      title: form.title || null,
      value: parsed as never,
      effective_from: form.effective_from || null,
      status: form.effective_from && new Date(form.effective_from) > new Date() ? "scheduled" : "draft",
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة نسخة القانون");
    setForm({ rule_key: "", version: "", title: "", effective_from: "", value: "{}", notes: "" });
    invalidate();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("legal_rule_versions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث الحالة");
    invalidate();
  };

  const exportRules = () => {
    const payload = JSON.stringify(rules ?? [], null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `legal-rules-${country}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRules = async (file: File) => {
    try {
      const rows = JSON.parse(await file.text()) as Array<Record<string, unknown>>;
      const payload = rows.map((r) => ({
        country_code: String(r["country_code"] ?? country),
        rule_key: String(r["rule_key"]),
        version: String(r["version"]),
        title: (r["title"] as string) ?? null,
        value: (r["value"] ?? {}) as never,
        effective_from: (r["effective_from"] as string) ?? null,
        status: String(r["status"] ?? "draft"),
      }));
      const { error } = await supabase.from("legal_rule_versions").upsert(payload, {
        onConflict: "country_code,rule_key,version",
      });
      if (error) throw error;
      toast.success(`تم استيراد ${payload.length} نسخة`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    }
  };

  const rowA = (rules ?? []).find((r) => r.id === compare.a);
  const rowB = (rules ?? []).find((r) => r.id === compare.b);

  return (
    <AdminShell
      permission="legal.manage"
      title="إدارة القوانين"
      description="إصدارات القوانين لكل دولة مع الجدولة والتعطيل والاستيراد والتصدير ومقارنة النسخ"
      icon={Scale}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportRules}>
            <Download className="h-4 w-4 ml-1" /> تصدير
          </Button>
          <label>
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="h-4 w-4 ml-1" /> استيراد</span>
            </Button>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importRules(f);
              }}
            />
          </label>
        </div>
      }
    >
      <Card className="p-4 mb-4">
        <Label className="text-xs">الدولة</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(countries ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name_ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 mb-4">
        <h3 className="font-bold text-sm mb-3">إضافة / إصدار نسخة قانون</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">مفتاح القانون</Label>
            <Input value={form.rule_key} onChange={(e) => setForm({ ...form, rule_key: e.target.value })} placeholder="eosb" />
          </div>
          <div>
            <Label className="text-xs">النسخة</Label>
            <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="2026.1" />
          </div>
          <div>
            <Label className="text-xs">العنوان</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">تاريخ السريان</Label>
            <Input
              type="date"
              value={form.effective_from}
              onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">القيمة (JSON)</Label>
            <Textarea
              dir="ltr"
              className="font-mono text-xs"
              rows={4}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <Button className="mt-3" onClick={addRule}><Plus className="h-4 w-4 ml-1" /> إصدار النسخة</Button>
      </Card>

      <Card className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="p-2 text-right">المفتاح</th>
              <th className="p-2 text-right">النسخة</th>
              <th className="p-2 text-right">العنوان</th>
              <th className="p-2 text-right">السريان</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2"><code className="text-xs">{r.rule_key}</code></td>
                <td className="p-2">{r.version}</td>
                <td className="p-2">{r.title ?? "—"}</td>
                <td className="p-2 text-xs">{r.effective_from ?? "—"}</td>
                <td className="p-2">
                  <Badge variant={r.status === "active" ? "default" : "outline"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </td>
                <td className="p-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "active")}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "disabled")}>
                    <Ban className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(rules ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد نسخ قوانين لهذه الدولة</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-1">
          <GitCompare className="h-4 w-4" /> مقارنة نسختين
        </h3>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <Select value={compare.a} onValueChange={(v) => setCompare({ ...compare, a: v })}>
            <SelectTrigger><SelectValue placeholder="النسخة الأولى" /></SelectTrigger>
            <SelectContent>
              {(rules ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.rule_key} · {r.version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={compare.b} onValueChange={(v) => setCompare({ ...compare, b: v })}>
            <SelectTrigger><SelectValue placeholder="النسخة الثانية" /></SelectTrigger>
            <SelectContent>
              {(rules ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.rule_key} · {r.version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rowA && rowB && (
          <div className="grid md:grid-cols-2 gap-3">
            <pre dir="ltr" className="text-[11px] bg-muted rounded p-3 overflow-auto max-h-72">
              {JSON.stringify(rowA.value, null, 2)}
            </pre>
            <pre dir="ltr" className="text-[11px] bg-muted rounded p-3 overflow-auto max-h-72">
              {JSON.stringify(rowB.value, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
