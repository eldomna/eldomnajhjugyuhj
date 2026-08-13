import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Lock } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/payment-methods")({
  head: () => ({ meta: [{ title: "وسائل الدفع — حاسبة الحقوق العمالية" }] }),
  component: PaymentMethodsPage,
});

function PaymentMethodsPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
  }, []);

  // Public view: no account number / holder. Signed-in users get the full
  // table (RLS allows authenticated reads of active rows).
  const { data } = useQuery({
    queryKey: ["payment-methods-public", !!user],
    queryFn: async () => {
      if (user) {
        const { data } = await (supabase as any)
          .from("payment_methods").select("*").eq("is_active", true).order("sort_order");
        return data || [];
      }
      const { data } = await (supabase as any)
        .from("payment_methods_public").select("*").order("sort_order");
      return data || [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">وسائل الدفع</h1>
        </div>
        {!data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد وسائل دفع متاحة حالياً.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.map((m: any) => (
              <Card key={m.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  {m.logo_url && <img src={m.logo_url} alt={m.name} className="h-10 w-10 object-contain" />}
                  <h3 className="font-bold">{m.name}</h3>
                </div>
                {user ? (
                  <>
                    {m.account_number && <p className="text-sm"><span className="text-muted-foreground">الرقم:</span> <span className="font-mono">{m.account_number}</span></p>}
                    {m.account_holder && <p className="text-sm"><span className="text-muted-foreground">باسم:</span> {m.account_holder}</p>}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> سجّل الدخول لعرض بيانات الحساب
                  </p>
                )}
                {m.instructions && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{m.instructions}</p>}
              </Card>
            ))}
          </div>
        )}
        {!user && (
          <div className="mt-6 text-center">
            <Link to="/auth"><Button variant="outline">تسجيل الدخول لعرض بيانات الحسابات</Button></Link>
          </div>
        )}
      </main>
    </div>
  );
}
