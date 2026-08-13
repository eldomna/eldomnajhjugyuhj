import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VerifiedBadge } from "@/components/lawyers/LawyerCard";
import { MapPin, Phone, Mail, MessageCircle, Star, Briefcase, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/lawyers/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `محامٍ موثّق — ${params.slug} • دليل المحامين` },
      { name: "description", content: "ملف محامٍ يمني موثّق: التخصصات، الخبرة، التقييمات، ومعلومات التواصل." },
      { property: "og:title", content: `محامٍ موثّق — ${params.slug}` },
      { property: "og:description", content: "ملف محامٍ يمني موثّق: التخصصات، الخبرة، التقييمات، ومعلومات التواصل." },
    ],
  }),
  component: LawyerProfile,
});

function LawyerProfile() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
  }, []);

  const { data: lawyer, isLoading } = useQuery({
    queryKey: ["lawyer", slug],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lawyers_public")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  // Contact channels are PII: they are not selectable from the base table.
  // A signed-in user fetches them one lawyer at a time through a gated RPC.
  const { data: contact } = useQuery({
    queryKey: ["lawyer-contact", lawyer?.id, user?.id],
    enabled: !!lawyer?.id && !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_lawyer_contact", {
        _lawyer_id: lawyer.id,
      });
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as { phone: string | null; whatsapp: string | null; email: string | null } | null;
    },
  });


  const { data: reviews } = useQuery({
    queryKey: ["lawyer-reviews", lawyer?.id],
    enabled: !!lawyer?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lawyer_reviews")
        .select("id,rating,comment,created_at,user_id")
        .eq("lawyer_id", lawyer.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <div className="min-h-screen flex flex-col"><AppHeader /><main className="flex-1 container mx-auto px-4 py-8">جارٍ التحميل...</main></div>;
  if (!lawyer) return <div className="min-h-screen flex flex-col"><AppHeader /><main className="flex-1 container mx-auto px-4 py-8 text-center"><p>لم يتم العثور على المحامي.</p><Link to="/lawyers" className="text-primary hover:underline">العودة للدليل</Link></main></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/lawyers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للدليل
        </Link>

        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="h-28 w-28 shrink-0 rounded-full overflow-hidden bg-muted grid place-items-center mx-auto sm:mx-0">
              {lawyer.photo_url ? <img src={lawyer.photo_url} alt={lawyer.full_name} className="h-full w-full object-cover" /> : <span className="text-4xl font-bold text-muted-foreground">{lawyer.full_name.charAt(0)}</span>}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold">{lawyer.full_name}</h1>
                  {lawyer.office_name && <p className="text-muted-foreground">{lawyer.office_name}</p>}
                </div>
                {lawyer.verification_status === "approved" && <VerifiedBadge size="md" />}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{lawyer.governorate}{lawyer.city ? ` — ${lawyer.city}` : ""}</span>
                {lawyer.years_experience ? <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" />{lawyer.years_experience} سنة خبرة</span> : null}
                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><Star className="h-4 w-4 fill-current" />{Number(lawyer.avg_rating).toFixed(1)} ({lawyer.reviews_count})</span>
              </div>
              {lawyer.specializations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {lawyer.specializations.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              )}
            </div>
          </div>

          {lawyer.bio && <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap">{lawyer.bio}</p>}

          {user ? (
            <div className="grid sm:grid-cols-2 gap-2 mt-5">
              {contact?.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 text-sm hover:text-primary"><Phone className="h-4 w-4" />{contact.phone}</a>}
              {contact?.whatsapp && <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm hover:text-primary"><MessageCircle className="h-4 w-4" />{contact.whatsapp}</a>}
              {contact?.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 text-sm hover:text-primary"><Mail className="h-4 w-4" />{contact.email}</a>}
              {contact && !contact.phone && !contact.whatsapp && !contact.email && (
                <p className="text-sm text-muted-foreground">لا توجد بيانات تواصل متاحة.</p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
              <span>سجّل الدخول لعرض بيانات التواصل (هاتف، واتساب، بريد).</span>
              <Link to="/auth"><Button size="sm" variant="outline">تسجيل الدخول</Button></Link>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">التقييمات ({lawyer.reviews_count})</h2>
            {user && <ReviewDialog lawyerId={lawyer.id} userId={user.id} onSaved={() => { qc.invalidateQueries({ queryKey: ["lawyer-reviews", lawyer.id] }); qc.invalidateQueries({ queryKey: ["lawyer", slug] }); }} />}
            {!user && <Link to="/auth"><Button size="sm" variant="outline">سجل الدخول للتقييم</Button></Link>}
          </div>
          {!reviews || reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد تقييمات بعد.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r: any) => (
                <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                    ))}
                    <span className="text-xs text-muted-foreground mr-2">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                  </div>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function ReviewDialog({ lawyerId, userId, onSaved }: { lawyerId: string; userId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("lawyer_reviews").upsert({
        lawyer_id: lawyerId, user_id: userId, rating, comment: comment.trim() || null,
      }, { onConflict: "lawyer_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ التقييم"); setOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">أضف تقييمك</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تقييم المحامي</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-2 block">التقييم</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">تعليق (اختياري)</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1000} />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? "جارٍ الحفظ..." : "حفظ التقييم"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
