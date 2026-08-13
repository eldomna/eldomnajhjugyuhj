import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/knowledge/$slug")({
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data } = await (supabase as any).from("knowledge_articles").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/knowledge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للمعرفة
        </Link>
        {isLoading ? <p>جارٍ التحميل...</p> : !article ? <p>لم يتم العثور على المقال.</p> : (
          <Card className="p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-3">{article.title}</h1>
            {article.excerpt && <p className="text-muted-foreground mb-5">{article.excerpt}</p>}
            <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">{article.body}</div>
          </Card>
        )}
      </main>
    </div>
  );
}
