import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronRight, Globe2, Plus, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_admin/admin/countries")({
  head: () => ({
    meta: [
      { title: "إدارة الدول • لوحة التحكم" },
      { name: "description", content: "إضافة الدول المدعومة وتعديل بياناتها وتفعيلها أو إيقافها دون تعديل الكود." },
      { property: "og:title", content: "إدارة الدول • لوحة التحكم" },
      { property: "og:description", content: "التحكم الكامل في قائمة الدول والمحركات الحسابية المرتبطة بها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminCountries,
});

type Row = {
  code: string;
  name_ar: string;
  name_en: string;
  flag: string;
  currency: string;
  engine: string;
  calculator_path: string;
  description_ar: string | null;
  description_en: string | null;
  is_active: boolean;
  sort_order: number;
};

const blank: Row = {
  code: "",
  name_ar: "",
  name_en: "",
  flag: "",
  currency: "SAR",
  engine: "sa",
  calculator_path: "/calculator",
  description_ar: "",
  description_en: "",
  is_active: true,
  sort_order: 10,
};

function AdminCountries() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Row>(blank);

  const list = useQuery({
    queryKey: ["admin", "countries"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.from("countries").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const payload = { ...row, code: row.code.trim().toUpperCase() };
      if (!payload.code || !payload.name_ar || !payload.name_en) {
        throw new Error("الرمز والاسم بالعربية والإنجليزية حقول مطلوبة");
      }
      const { error } = await supabase.from("countries").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ بيانات الدولة");
      setDraft(blank);
      void qc.invalidateQueries({ queryKey: ["admin", "countries"] });
      void qc.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحفظ"),
  });

  const toggle = useMutation({
    mutationFn: async ({ code, is_active }: { code: string; is_active: boolean }) => {
      const { error } = await supabase.from("countries").update({ is_active }).eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "countries"] });
      void qc.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر التحديث"),
  });

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-2xl font-bold">
              <Globe2 className="h-6 w-6 text-primary" /> إدارة الدول
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أي دولة جديدة تُضاف من هنا وتظهر مباشرة في شاشة اختيار الدولة.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-1">
            <Link to="/admin">
              <ChevronRight className="h-4 w-4" /> لوحة التحكم
            </Link>
          </Button>
        </div>

        <Card className="mb-6 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <Plus className="h-4 w-4" /> إضافة / تعديل دولة
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["code", "الرمز (SA / YE)"],
                ["name_ar", "الاسم بالعربية"],
                ["name_en", "الاسم بالإنجليزية"],
                ["flag", "العلم (رمز تعبيري)"],
                ["currency", "العملة"],
                ["engine", "المحرك الحسابي"],
                ["calculator_path", "مسار الحاسبة"],
              ] as [keyof Row, string][]
            ).map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  value={String(draft[k] ?? "")}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">الترتيب</Label>
              <Input
                type="number"
                dir="ltr"
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">الوصف بالعربية</Label>
              <Input
                value={draft.description_ar ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, description_ar: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">الوصف بالإنجليزية</Label>
              <Input
                value={draft.description_en ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, description_en: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
            />
            <span className="text-sm">مفعّلة</span>
            <Button
              className="ms-auto gap-2"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
            >
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </div>
        </Card>

        {list.isLoading && (
          <Card className="space-y-3 p-6">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </Card>
        )}

        {list.isError && (
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="mb-4 text-sm text-muted-foreground">
              {(list.error as Error)?.message ?? "تعذّر تحميل الدول"}
            </p>
            <Button variant="outline" className="gap-2" onClick={() => void list.refetch()}>
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </Card>
        )}

        {list.data && list.data.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            لا توجد دول مسجّلة بعد.
          </Card>
        )}

        {list.data && list.data.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.data.map((c) => (
              <Card key={c.code} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.flag}</span>
                      <div>
                        <p className="font-bold">{c.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.name_en} • {c.code} • {c.currency}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      المحرك: {c.engine} — المسار: {c.calculator_path}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) => toggle.mutate({ code: c.code, is_active: v })}
                    />
                    <Button size="sm" variant="outline" onClick={() => setDraft(c)}>
                      تعديل
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
