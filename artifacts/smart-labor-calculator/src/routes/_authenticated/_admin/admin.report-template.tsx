import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileCog, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/report-template")({
  component: AdminReportTemplate,
});

function AdminReportTemplate() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pdf_template_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [watermark, setWatermark] = useState("");
  const [footer, setFooter] = useState("");
  const [signature, setSignature] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [verification, setVerification] = useState("");

  useEffect(() => {
    if (data) {
      setName(data.name || "");
      setWatermark(data.watermark || "");
      setFooter(data.footer || "");
      setSignature(data.signature_block || "");
      setDisclaimer(data.disclaimer || "");
      setVerification(data.verification_statement || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.id) {
        const { error } = await supabase.from("pdf_templates").insert({
          name,
          watermark: watermark || null,
          footer: footer || null,
          signature_block: signature || null,
          disclaimer: disclaimer || null,
          verification_statement: verification || null,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pdf_templates")
          .update({
            name,
            watermark: watermark || null,
            footer: footer || null,
            signature_block: signature || null,
            disclaimer: disclaimer || null,
            verification_statement: verification || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ القالب");
      qc.invalidateQueries({ queryKey: ["pdf_template_active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <FileCog className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">قالب تقرير PDF</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          العلامة المائية، التذييل، كتلة التوقيع، إخلاء المسؤولية وعبارة التحقق — تنطبق على جميع التقارير الصادرة.
        </p>

        <Card className="p-6 space-y-5">
          <div>
            <Label htmlFor="tname" className="mb-1.5 block">اسم القالب</Label>
            <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wm" className="mb-1.5 block">العلامة المائية (نص أسفل التقرير)</Label>
            <Input id="wm" value={watermark} onChange={(e) => setWatermark(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sig" className="mb-1.5 block">كتلة التوقيع</Label>
            <Textarea id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="dis" className="mb-1.5 block">نص إخلاء المسؤولية</Label>
            <Textarea id="dis" value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="ver" className="mb-1.5 block">عبارة التحقق</Label>
            <Textarea id="ver" value={verification} onChange={(e) => setVerification(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="ft" className="mb-1.5 block">تذييل القالب</Label>
            <Textarea id="ft" value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
            <Save className="h-4 w-4" /> {save.isPending ? "جارٍ الحفظ..." : "حفظ القالب"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
