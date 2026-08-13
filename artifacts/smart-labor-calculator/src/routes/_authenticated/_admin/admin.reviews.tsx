import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, EyeOff, Eye, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/reviews")({
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lawyer_reviews")
        .select("id,rating,comment,is_hidden,created_at,lawyer_id,user_id,lawyers(full_name,slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, hide }: { id: string; hide: boolean }) => {
      const { error } = await (supabase as any).from("lawyer_reviews").update({ is_hidden: hide }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("lawyer_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6"><MessageSquare className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">إدارة التقييمات</h1></div>
        <div className="grid gap-3">
          {(data || []).map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <strong className="text-sm">{r.lawyers?.full_name || "—"}</strong>
                    <span className="inline-flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />)}</span>
                    {r.is_hidden && <Badge variant="destructive">مخفي</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</span>
                  </div>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: r.id, hide: !r.is_hidden })}>
                    {r.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا التقييم؟")) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
          {(data || []).length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد تقييمات.</p>}
        </div>
      </main>
    </div>
  );
}
