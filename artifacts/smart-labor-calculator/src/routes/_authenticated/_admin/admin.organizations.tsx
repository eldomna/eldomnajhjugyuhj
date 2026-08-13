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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/organizations")({
  component: OrganizationsPage,
});

const TIMEZONES = ["Asia/Riyadh", "Asia/Aden", "Asia/Dubai", "Africa/Cairo", "UTC"];
const CURRENCIES = ["SAR", "YER", "AED", "EGP", "USD"];
const LANGS = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

function OrganizationsPage() {
  const qc = useQueryClient();
  const [org, setOrg] = useState({
    name: "",
    country_code: "SA",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    language: "ar",
  });
  const [branch, setBranch] = useState({
    organization_id: "",
    name: "",
    city: "",
    country_code: "SA",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    language: "ar",
  });

  const { data: orgs } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, country_code, currency, timezone, language, is_active, created_at")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["admin", "branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, organization_id, name, city, currency, timezone, language, is_active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: countries } = useQuery({
    queryKey: ["admin", "countries-lite"],
    queryFn: async () =>
      (await supabase.from("countries").select("code, name_ar").order("sort_order")).data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    qc.invalidateQueries({ queryKey: ["admin", "branches"] });
    qc.invalidateQueries({ queryKey: ["admin", "branches-lite"] });
  };

  const createOrg = async () => {
    if (!org.name) return toast.error("أدخل اسم المؤسسة");
    const { error } = await supabase.from("organizations").insert(org);
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة المؤسسة");
    setOrg({ ...org, name: "" });
    invalidate();
  };

  const createBranch = async () => {
    if (!branch.organization_id || !branch.name) return toast.error("اختر المؤسسة وأدخل اسم الفرع");
    const { error } = await supabase.from("branches").insert(branch);
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة الفرع");
    setBranch({ ...branch, name: "", city: "" });
    invalidate();
  };

  return (
    <AdminShell
      permission="organizations.manage"
      title="المؤسسات والفروع"
      description="هيكل متعدد المؤسسات والفروع مع إعدادات مستقلة لكل فرع (عملة، منطقة زمنية، لغة)"
      icon={Building2}
    >
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">إضافة مؤسسة</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">الاسم</Label>
              <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الدولة</Label>
                <Select value={org.country_code} onValueChange={(v) => setOrg({ ...org, country_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(countries ?? []).map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">العملة</Label>
                <Select value={org.currency} onValueChange={(v) => setOrg({ ...org, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المنطقة الزمنية</Label>
                <Select value={org.timezone} onValueChange={(v) => setOrg({ ...org, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">اللغة</Label>
                <Select value={org.language} onValueChange={(v) => setOrg({ ...org, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createOrg} className="w-full"><Plus className="h-4 w-4 ml-1" /> إضافة مؤسسة</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">إضافة فرع</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">المؤسسة</Label>
              <Select
                value={branch.organization_id}
                onValueChange={(v) => setBranch({ ...branch, organization_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="اختر المؤسسة" /></SelectTrigger>
                <SelectContent>
                  {(orgs ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">اسم الفرع</Label>
                <Input value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">المدينة</Label>
                <Input value={branch.city} onChange={(e) => setBranch({ ...branch, city: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">العملة</Label>
                <Select value={branch.currency} onValueChange={(v) => setBranch({ ...branch, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المنطقة الزمنية</Label>
                <Select value={branch.timezone} onValueChange={(v) => setBranch({ ...branch, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createBranch} className="w-full"><Plus className="h-4 w-4 ml-1" /> إضافة فرع</Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {(orgs ?? []).map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold">{o.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {o.country_code} · {o.currency} · {o.timezone} · {o.language}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={o.is_active ? "default" : "secondary"}>
                  {o.is_active ? "مفعّلة" : "معطّلة"}
                </Badge>
                <Switch
                  checked={o.is_active}
                  onCheckedChange={async (v) => {
                    await supabase.from("organizations").update({ is_active: v }).eq("id", o.id);
                    invalidate();
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("حذف المؤسسة وكل فروعها؟")) return;
                    await supabase.from("organizations").delete().eq("id", o.id);
                    invalidate();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
              {(branches ?? [])
                .filter((b) => b.organization_id === o.id)
                .map((b) => (
                  <div key={b.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{b.name}</span>
                      <Switch
                        checked={b.is_active}
                        onCheckedChange={async (v) => {
                          await supabase.from("branches").update({ is_active: v }).eq("id", b.id);
                          invalidate();
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.city || "—"} · {b.currency} · {b.timezone}
                    </p>
                  </div>
                ))}
              {(branches ?? []).filter((b) => b.organization_id === o.id).length === 0 && (
                <p className="text-xs text-muted-foreground">لا توجد فروع</p>
              )}
            </div>
          </Card>
        ))}
        {(orgs ?? []).length === 0 && (
          <Card className="p-6 text-center text-muted-foreground text-sm">لا توجد مؤسسات بعد</Card>
        )}
      </div>
    </AdminShell>
  );
}
