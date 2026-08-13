import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, FileDown, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { generateReportPDF } from "@/lib/pdf";
import { renderSaReportHtml, downloadSaReportDocument } from "@/lib/saudi/report-render";
import {
  DEMO_YE_INPUT,
  demoSaudiReport,
  demoYemenResult,
  saudiExpectations,
  yemenExpectations,
} from "@/lib/pdf-demo";
import { verifyReportExport, type CheckResult } from "@/lib/pdf-verify";
import type { PdfRenderStats } from "@/lib/pdf-engine";

export const Route = createFileRoute("/pdf-preview")({
  ssr: false,
  component: PdfPreviewPage,
  head: () => ({
    meta: [
      { title: "معاينة تصدير PDF | حاسبة العمال الذكية" },
      {
        name: "description",
        content: "صفحة داخلية لمعاينة نسخة PDF للحاسبة اليمنية والسعودية وفحص جودة العربية والقيم.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "معاينة تصدير PDF" },
      { property: "og:description", content: "معاينة وفحص آلي لتقارير PDF الداخلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DEMO_SERIAL = "YE-DEMO-2026-000123";

function ChecksPanel({ checks, stats }: { checks: CheckResult[]; stats: PdfRenderStats | null }) {
  if (checks.length === 0) return null;
  const failed = checks.filter((c) => !c.pass).length;
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h3 className="truncate text-base font-bold">نتيجة الفحص الآلي</h3>
        <Badge variant={failed === 0 ? "default" : "destructive"} className="shrink-0">
          {failed === 0 ? `نجحت جميع الفحوص (${checks.length})` : `${failed} فحص فاشل`}
        </Badge>
      </div>
      {stats && (
        <p className="text-xs text-muted-foreground" dir="rtl">
          زمن التصدير {(stats.durationMs / 1000).toFixed(2)} ثانية · {stats.pages} صفحة ·{" "}
          {stats.sections} قسم · حجم الملف {(stats.bytes / 1024).toFixed(0)} ك.ب · الخط:{" "}
          {stats.fontsReady ? "محمَّل" : "غير محمَّل"}
        </p>
      )}
      <ul className="divide-y rounded-lg border">
        {checks.map((c) => (
          <li
            key={c.id}
            data-pass={c.pass ? "1" : "0"}
            className="flex items-start gap-3 p-3 text-sm"
          >
            {c.pass ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="min-w-0">
              <span className="block font-medium">{c.label}</span>
              <span className="block text-xs text-muted-foreground" dir="auto">
                {c.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewFrame({ html }: { html: string }) {
  const doc = useMemo(
    () =>
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" />
      </head><body style="margin:0;background:#f1f5f9;display:flex;justify-content:center;padding:16px">${html}</body></html>`,
    [html],
  );
  return (
    <iframe
      title="معاينة التقرير"
      srcDoc={doc}
      className="h-[70vh] w-full rounded-lg border bg-white"
    />
  );
}

function PdfPreviewPage() {
  const [yeHtml, setYeHtml] = useState("");
  const [saHtml, setSaHtml] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckResult[]>>({});
  const [stats, setStats] = useState<Record<string, PdfRenderStats | null>>({});

  const yeResult = useMemo(() => demoYemenResult(), []);
  const saDoc = useMemo(() => demoSaudiReport(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const html = (await generateReportPDF(
        DEMO_YE_INPUT,
        yeResult,
        { platformName: "حاسبة العمال الذكية" },
        { serial: DEMO_SERIAL, issuedAt: new Date("2026-01-15T09:30:00.000Z") },
        { returnHtml: true },
      )) as string;
      if (alive) setYeHtml(html);
      if (alive) setSaHtml(renderSaReportHtml(saDoc, { checksum: "DEMOCHECKSUM0001" }));
    })().catch((e) => toast.error(String(e)));
    return () => {
      alive = false;
    };
  }, [yeResult, saDoc]);

  const downloadYemen = async () => {
    setBusy("ye-download");
    try {
      await generateReportPDF(
        DEMO_YE_INPUT,
        yeResult,
        { platformName: "حاسبة العمال الذكية" },
        { serial: DEMO_SERIAL, issuedAt: new Date() },
        { fast: true, onStats: (s) => setStats((p) => ({ ...p, ye: s })) },
      );
      toast.success("تم تنزيل تقرير الحاسبة اليمنية");
    } catch (e) {
      toast.error(`فشل التنزيل: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const downloadSaudi = async () => {
    setBusy("sa-download");
    try {
      await downloadSaReportDocument(saDoc, "DEMOCHECKSUM0001", {
        fast: true,
        onStats: (s) => setStats((p) => ({ ...p, sa: s })),
      });
      toast.success("تم تنزيل التقرير السعودي");
    } catch (e) {
      toast.error(`فشل التنزيل: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const runChecks = async (key: "ye" | "sa") => {
    setBusy(`${key}-checks`);
    try {
      if (key === "ye") {
        const exp = yemenExpectations(yeResult);
        const blobStart = Date.now();
        const blob = (await generateReportPDF(
          DEMO_YE_INPUT,
          yeResult,
          { platformName: "حاسبة العمال الذكية" },
          { serial: DEMO_SERIAL, issuedAt: new Date("2026-01-15T09:30:00.000Z") },
          { returnBlob: true, fast: true, onStats: (s) => setStats((p) => ({ ...p, ye: s })) },
        )) as Blob;
        const result = await verifyReportExport({ html: yeHtml, ...exp });
        result.push({
          id: "pdf-built",
          label: "ملف PDF أُنتج كاملاً داخل المهلة",
          pass: blob.size > 20_000 && Date.now() - blobStart < 60_000,
          detail: `${(blob.size / 1024).toFixed(0)} ك.ب في ${((Date.now() - blobStart) / 1000).toFixed(2)} ثانية`,
        });
        setChecks((p) => ({ ...p, ye: result }));
      } else {
        const exp = saudiExpectations(saDoc);
        const started = Date.now();
        const blob = (await downloadSaReportDocument(saDoc, "DEMOCHECKSUM0001", {
          fast: true,
          returnBlob: true,
          onStats: (s) => setStats((p) => ({ ...p, sa: s })),
        })) as Blob;
        const result = await verifyReportExport({ html: saHtml, ...exp });
        result.push({
          id: "pdf-built",
          label: "ملف PDF أُنتج كاملاً داخل المهلة",
          pass: blob.size > 20_000 && Date.now() - started < 60_000,
          detail: `${(blob.size / 1024).toFixed(0)} ك.ب في ${((Date.now() - started) / 1000).toFixed(2)} ثانية`,
        });
        setChecks((p) => ({ ...p, sa: result }));
      }
      toast.success("انتهى الفحص الآلي");
    } catch (e) {
      toast.error(`فشل الفحص: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-black sm:text-3xl">معاينة تصدير PDF (صفحة داخلية)</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نسخة PDF لكل من الحاسبة اليمنية والسعودية ببيانات تجريبية، مع فحص آلي للخط العربي والاتجاه
          RTL والمحاذاة والجداول ومطابقة القيم مع نتيجة الحاسبة.
        </p>
      </header>

      <Tabs defaultValue="ye">
        <TabsList>
          <TabsTrigger value="ye">الحاسبة اليمنية</TabsTrigger>
          <TabsTrigger value="sa">الحاسبة السعودية</TabsTrigger>
        </TabsList>

        <TabsContent value="ye">
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button onClick={downloadYemen} disabled={busy !== null} data-testid="ye-download">
                {busy === "ye-download" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                تنزيل PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => runChecks("ye")}
                disabled={busy !== null || !yeHtml}
                data-testid="ye-checks"
              >
                {busy === "ye-checks" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                تشغيل الفحص الآلي
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                الإجمالي المتوقع: {yeResult.total_due.toLocaleString("en-US")} ريال يمني
              </span>
            </div>
            {yeHtml ? <PreviewFrame html={yeHtml} /> : <p className="text-sm">جارٍ التحضير…</p>}
            <ChecksPanel checks={checks.ye ?? []} stats={stats.ye ?? null} />
          </Card>
        </TabsContent>

        <TabsContent value="sa">
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button onClick={downloadSaudi} disabled={busy !== null} data-testid="sa-download">
                {busy === "sa-download" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                تنزيل PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => runChecks("sa")}
                disabled={busy !== null || !saHtml}
                data-testid="sa-checks"
              >
                {busy === "sa-checks" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                تشغيل الفحص الآلي
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                الصافي المتوقع: {saDoc.summary.netTotal.toLocaleString("en-US")} ريال سعودي
              </span>
            </div>
            {saHtml ? <PreviewFrame html={saHtml} /> : <p className="text-sm">جارٍ التحضير…</p>}
            <ChecksPanel checks={checks.sa ?? []} stats={stats.sa ?? null} />
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
