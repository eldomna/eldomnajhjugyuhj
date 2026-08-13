import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "المعرفة القانونية — حقوق العمال اليمنيين" },
      { name: "description", content: "مقالات وشروحات حول قانون العمل اليمني: حقوق العمال، تأخر الرواتب، الإجازات، مكافأة نهاية الخدمة، والفصل التعسفي." },
      { property: "og:title", content: "المعرفة القانونية" },
      { property: "og:description", content: "شروحات قانون العمل اليمني." },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const [q, setQ] = useState("");
  const { data: cats } = useQuery({
    queryKey: ["knowledge-cats"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("knowledge_categories").select("*").order("sort_order");
      return data || [];
    },
  });
  const { data: articles } = useQuery({
    queryKey: ["knowledge-articles"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("knowledge_articles")
        .select("id,title,slug,excerpt,category_id,created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return articles || [];
    const s = q.trim();
    return (articles || []).filter((a: any) => a.title.includes(s) || (a.excerpt || "").includes(s));
  }, [articles, q]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">المعرفة القانونية</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">مقالات حول قانون العمل اليمني وحقوق العمال.</p>

        <div className="relative mb-6">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في المقالات..." className="pr-10" />
        </div>

        {cats && cats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {cats.map((c: any) => <span key={c.id} className="text-xs px-3 py-1 rounded-full bg-secondary">{c.name}</span>)}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد مقالات بعد.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((a: any) => (
              <Link key={a.id} to="/knowledge/$slug" params={{ slug: a.slug }}>
                <Card className="p-5 hover:border-primary transition-colors">
                  <h3 className="font-bold mb-1">{a.title}</h3>
                  {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{a.excerpt}</p>}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
