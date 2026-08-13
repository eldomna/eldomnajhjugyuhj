import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LawyerCard, type LawyerListItem } from "@/components/lawyers/LawyerCard";
import { GOVERNORATES, SPECIALIZATIONS } from "@/lib/governorates";
import { useState, useMemo } from "react";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/lawyers")({
  head: () => ({
    meta: [
      { title: "دليل المحامين — حاسبة العمال الذكية" },
      { name: "description", content: "ابحث عن محامٍ يمني موثّق حسب المحافظة والتخصص. تقييمات حقيقية وملفات تعريف موثّقة." },
      { property: "og:title", content: "دليل المحامين اليمنيين الموثّقين" },
      { property: "og:description", content: "ابحث عن محامٍ يمني موثّق حسب المحافظة والتخصص." },
    ],
  }),
  component: LawyersPage,
});

function LawyersPage() {
  const [q, setQ] = useState("");
  const [gov, setGov] = useState<string>("all");
  const [spec, setSpec] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["lawyers", "list"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lawyers_public")
        .select("id,full_name,slug,photo_url,governorate,city,office_name,years_experience,specializations,verification_status,avg_rating,reviews_count")
        .order("avg_rating", { ascending: false });
      return (data || []) as LawyerListItem[];
    },
  });

  const filtered = useMemo(() => {
    let list = data || [];
    if (gov !== "all") list = list.filter((l) => l.governorate === gov);
    if (spec !== "all") list = list.filter((l) => (l.specializations || []).includes(spec));
    if (q.trim()) {
      const s = q.trim();
      list = list.filter((l) =>
        l.full_name.includes(s) || (l.office_name || "").includes(s) || (l.city || "").includes(s)
      );
    }
    return list;
  }, [data, q, gov, spec]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">دليل المحامين</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">ابحث عن محامٍ يمني موثّق حسب المحافظة والتخصص.</p>

        <div className="grid sm:grid-cols-[1fr_180px_180px] gap-3 mb-6">
          <Input placeholder="ابحث بالاسم أو المكتب أو المدينة..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={gov} onValueChange={setGov}>
            <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المحافظات</SelectItem>
              {GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={spec} onValueChange={setSpec}>
            <SelectTrigger><SelectValue placeholder="التخصص" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التخصصات</SelectItem>
              {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">جارٍ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد نتائج مطابقة.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((l) => <LawyerCard key={l.id} lawyer={l} />)}
          </div>
        )}
      </main>
    </div>
  );
}
