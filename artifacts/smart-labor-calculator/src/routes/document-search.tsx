import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { findLocalDoc } from "@/lib/documents";
import { formatCurrency } from "@/lib/calculator";
import { ShieldCheck, ShieldAlert, Search, FileText, Loader2, ScanLine } from "lucide-react";

const serialSchema = z
  .string()
  .trim()
  .min(5, "أدخل رقماً تسلسلياً صالحاً")
  .max(40)
  .regex(/^[A-Za-z0-9\-]+$/, "صيغة الرقم غير صحيحة");

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; serial: string; employee: string | null; total: number; currency: string; date: string; source: "server" | "local" }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export const Route = createFileRoute("/document-search")({
  validateSearch: (s: Record<string, unknown>) => ({ serial: typeof s.serial === "string" ? s.serial : undefined }),
  head: () => ({
    meta: [
      { title: "بحث المستندات • حاسبة العمال الذكية" },
      { name: "description", content: "البحث عن الملفات الرسمية الصادرة عن المنصة والتحقق من صحتها برقم الملف التسلسلي." },
      { property: "og:title", content: "بحث وتحقق من المستندات الرسمية" },
      { property: "og:description", content: "ابحث برقم الملف للتحقق من صدور التقرير عن حاسبة العمال الذكية." },
    ],
  }),
  component: DocumentSearchPage,
});

function DocumentSearchPage() {
  const { serial: initial } = Route.useSearch();
  const [serial, setSerial] = useState(initial || "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = serialSchema.safeParse(serial);
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0].message });
      return;
    }
    setStatus({ kind: "loading" });
    const normalized = parsed.data.toUpperCase();
    const { data, error } = await supabase.rpc("verify_document", { p_serial: normalized });
    if (error) {
      setStatus({ kind: "error", message: "تعذر الاتصال بالخادم" });
      return;
    }
    if (data && data.length > 0) {
      const row = data[0];
      setStatus({
        kind: "ok",
        serial: row.serial_number,
        employee: "",
        total: Number(row.total_amount), currency: (row as { currency?: string }).currency ?? "YER",
        date: row.created_at,
        source: "server",
      });
      return;
    }
    const local = findLocalDoc(normalized);
    if (local) {
      setStatus({
        kind: "ok",
        serial: local.serial,
        employee: local.employee_name,
        total: local.total_amount, currency: local.currency ?? "YER",
        date: local.issued_at,
        source: "local",
      });
      return;
    }
    setStatus({ kind: "not_found" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="gov-gradient text-primary-foreground py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium mb-4">
                <ScanLine className="h-3.5 w-3.5" /> البحث في سجل المستندات الرسمية
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold">بحث المستندات</h1>
              <p className="mt-3 opacity-90 text-sm sm:text-base leading-relaxed">
                ابحث عن أي ملف رسمي صادر عن المنصة برقم الملف التسلسلي للتحقق من صحته ومطابقته للسجل المركزي.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 -mt-8 max-w-2xl pb-16">
          <Card className="p-5 sm:p-7 card-elev">
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="YML-2026-00001"
                  className="pr-10 font-mono text-base"
                  aria-label="رقم الملف التسلسلي"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={status.kind === "loading"} className="gap-2">
                {status.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                بحث وتحقق
              </Button>
            </form>

            <div className="mt-6">
              {status.kind === "ok" && (
                <div className="rounded-lg border-2 border-primary bg-primary-soft/40 p-5">
                  <div className="flex items-center gap-3 text-primary mb-3">
                    <ShieldCheck className="h-7 w-7" />
                    <div>
                      <p className="font-bold text-base">هذا الملف رسمي وصادر عن المنصة</p>
                      <p className="text-xs text-primary/80">
                        {status.source === "local" ? "محقق من السجل المحلي على هذا الجهاز" : "محقق من السجل المركزي للمنصة"}
                      </p>
                    </div>
                  </div>
                  <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                    <Field label="رقم الملف" value={<span className="font-mono">{status.serial}</span>} />
                    <Field label="تاريخ الإصدار" value={new Date(status.date).toLocaleString("ar-EG")} />
                    <Field label="اسم العامل" value={status.employee || "—"} />
                    <Field label="إجمالي المستحقات" value={<span className="font-bold text-primary tabular-nums">{formatCurrency(status.total, status.currency)}</span>} />
                  </dl>
                </div>
              )}

              {status.kind === "not_found" && (
                <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-5 flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
                  <div>
                    <p className="font-bold text-destructive">تنبيه: هذا الملف غير مسجل في المنصة أو قد يكون معدلاً.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      تأكد من نسخ الرقم التسلسلي بدقة كما يظهر في أعلى التقرير.
                    </p>
                  </div>
                </div>
              )}

              {status.kind === "error" && (
                <p className="text-sm text-destructive">{status.message}</p>
              )}

              {status.kind === "idle" && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> الرقم التسلسلي يظهر في الزاوية العلوية من تقرير PDF.
                </p>
              )}
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            تحتاج إصدار تقرير جديد؟ <Link to="/calculator" className="text-primary font-semibold">افتح الحاسبة</Link>
          </p>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-card border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
