import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateSaReport } from "@/lib/saudi/report.functions";
import { downloadSaReportDocument } from "@/lib/saudi/report-render";
import type { SaStoredReport } from "@/lib/saudi/report-helpers";

/** إصدار التقرير النهائي: يُبنى ويُخزَّن على الخادم ثم يُصدَّر PDF من المستند المخزَّن. */
export function SaReportExportButton({ caseId }: { caseId: string | null }) {
  const generate = useServerFn(generateSaReport);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SaStoredReport | null>(null);

  async function run() {
    if (!caseId) {
      toast.error("لا يمكن إصدار التقرير قبل حفظ الحسبة");
      return;
    }
    setBusy(true);
    try {
      const r = report ?? ((await generate({ data: { caseId } })) as SaStoredReport);
      setReport(r);
      await downloadSaReportDocument(r.document, r.checksum);
      toast.success(`تم إصدار التقرير ${r.reportNumber}`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إصدار التقرير");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full gap-2" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {report ? "إعادة تنزيل التقرير" : "إصدار وتنزيل التقرير النهائي PDF"}
      </Button>
      {report && (
        <div className="rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> رقم التقرير: <span dir="ltr">{report.reportNumber}</span>
          </div>
          <p className="text-muted-foreground">بصمة التحقق: <span dir="ltr">{report.checksum.slice(0, 24)}…</span></p>
          <p className="text-muted-foreground">التقرير مخزَّن ولا يمكن تعديله بعد الإصدار؛ أي تغيير في البيانات يستوجب إصداراً جديداً.</p>
        </div>
      )}
    </div>
  );
}
