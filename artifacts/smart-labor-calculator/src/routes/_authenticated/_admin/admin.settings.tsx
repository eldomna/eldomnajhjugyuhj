import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Image as ImageIcon, ShieldCheck, FileText, Calculator, Coins } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [clauses, setClauses] = useState("");
  const [footer, setFooter] = useState("");
  const [accessMode, setAccessMode] = useState<string>("free");
  const [enableInfoFx, setEnableInfoFx] = useState<boolean>(false);

  useEffect(() => {
    if (data) {
      setName(data.platform_name);
      setLogo(data.logo_url || "");
      setClauses(data.default_clauses || "");
      setFooter(data.report_footer || "");
      setAccessMode((data as any).calculator_access_mode || "free");
      setEnableInfoFx(Boolean((data as { enable_info_currency_conversion?: boolean }).enable_info_currency_conversion));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          platform_name: name,
          logo_url: logo || null,
          default_clauses: clauses || null,
          report_footer: footer || null,
          calculator_access_mode: accessMode,
          enable_info_currency_conversion: enableInfoFx,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      qc.invalidateQueries({ queryKey: ["platform_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">إعدادات تنسيق التقارير</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          هذه الإعدادات تنطبق على جميع تقارير PDF الصادرة من المنصة. لا يمكن للعميل تعديلها.
        </p>

        <Card className="p-6 space-y-5">
          <div>
            <Label htmlFor="name" className="mb-1.5 block">اسم المنصة (يظهر في رأس التقارير)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>

          <div>
            <Label htmlFor="logo" className="mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" /> رابط الشعار (PNG/JPG، يفضّل مربع)
            </Label>
            <Input
              id="logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              dir="ltr"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-2">
              يُستخدم الشعار في كل التقارير الرسمية الصادرة من المنصة.
            </p>
            {logo && (
              <div className="mt-3 inline-flex items-center justify-center bg-muted rounded-lg p-3">
                <img src={logo} alt="معاينة" className="h-16 w-16 object-contain" />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="clauses" className="mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> البنود/الملاحظات الافتراضية
            </Label>
            <Textarea
              id="clauses"
              value={clauses}
              onChange={(e) => setClauses(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="مثال: تُحتسب هذه المستحقات وفق قانون العمل اليمني رقم 5 لسنة 1995. تُسلَّم خلال 30 يوماً من انتهاء العقد..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              ستظهر في كل تقرير قبل قسم المراجع القانونية. ({clauses.length}/3000)
            </p>
          </div>

          <div>
            <Label htmlFor="footer" className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> نص تذييل التقرير
            </Label>
            <Textarea
              id="footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="مثال: للتواصل: info@example.com — هاتف: +967 1 234 567"
            />
            <p className="text-xs text-muted-foreground mt-1">{footer.length}/500</p>
          </div>

          <div className="border-t pt-5">
            <Label className="mb-1.5 flex items-center gap-1.5">
              <Calculator className="h-4 w-4" /> وضع الوصول للحاسبة
            </Label>
            <Select value={accessMode} onValueChange={setAccessMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">مجاني للجميع</SelectItem>
                <SelectItem value="premium">مدفوع (Premium)</SelectItem>
                <SelectItem value="hybrid">هجين (Hybrid)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              يتحكم في وصول المستخدمين للحاسبة. حالياً البنية التحتية فقط — لا يتم تفعيل أي قيود إلا عند طلبك لاحقاً.
            </p>
          </div>

          <div className="border-t pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <Coins className="h-4 w-4" /> تفعيل التحويل المعلوماتي للعملات
                </Label>
                <p className="text-xs text-muted-foreground">
                  عند التفعيل، تظهر للمستخدم ملاحظة:
                  <span className="block mt-1 italic">
                    «القيم المحولة معلوماتية فقط ولا تستخدم في الحسابات القانونية.»
                  </span>
                  لا يتم إجراء أي تحويل عملات تلقائي في الحسابات الرسمية.
                </p>
              </div>
              <Switch checked={enableInfoFx} onCheckedChange={setEnableInfoFx} />
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
