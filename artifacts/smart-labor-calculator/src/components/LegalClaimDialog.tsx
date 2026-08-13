import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateAr, formatServiceDuration } from "@/lib/calculator";
import type { CalculatorInput, CalculatorResult } from "@/lib/calculator";
import { Printer, Download, FileSignature } from "lucide-react";
import { useApprovedLegalReferences, formatLegalReference, PENDING_REFERENCE_NOTICE, type LegalReference } from "@/hooks/useLegalReferences";

interface LegalClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: CalculatorInput;
  result: CalculatorResult;
}

function buildClaimTemplate(input: CalculatorInput, result: CalculatorResult, refs: LegalReference[]) {
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const legalBasis = refs.length > 0
    ? "وبناءً على المراجع القانونية المعتمدة التالية:\n" + refs.map((r, i) => `  ${i + 1}. ${formatLegalReference(r)}`).join("\n")
    : PENDING_REFERENCE_NOTICE;
  return `بسم الله الرحمن الرحيم

السادة / المحكمة العمالية المختصة                            المحترمين

تحية طيبة وبعد،

الموضوع: مطالبة بمستحقات عمالية

أنا الموقع أدناه / ${input.employee_name || "................"}، عملت لدى السيد / المؤسسة: ${input.employer_name || "................"} في الفترة من ${formatDateAr(input.service_start_date)} إلى ${formatDateAr(input.service_end_date)} (مدة محسوبة تلقائياً: ${formatServiceDuration(result)} — إجمالي ${result.total_days} يوم)، براتب شهري قدره ${formatCurrency(input.monthly_salary, input.currency)}.

${legalBasis}

فإن الحقوق العمالية المضمونة المترتبة في ذمة صاحب العمل تتمثل في الآتي:

1) مكافأة نهاية الخدمة: ${formatCurrency(result.eos_benefit, input.currency)}
2) تعويض ساعات العمل الإضافية النهارية (بنسبة 150%): ${formatCurrency(result.day_overtime_amount, input.currency)}
3) تعويض ساعات العمل الإضافية الليلية (بنسبة 175%): ${formatCurrency(result.night_overtime_amount, input.currency)}

إجمالي الحقوق المضمونة المطالب بها: ${formatCurrency(result.total_due, input.currency)}
${result.legal_notes.length > 0 ? `
ملاحظات قانونية إضافية (تقديرات قضائية لا تدخل ضمن الإجمالي أعلاه):
${result.legal_notes.map((n, i) => `${i + 1}) ${n.title}: ${formatCurrency(n.amount, input.currency)} — ${n.warning}`).join("\n")}
` : ""}
لذا ألتمس من عدالة المحكمة الموقرة:
- إلزام المدعى عليه بسداد إجمالي الحقوق المضمونة المذكورة أعلاه.
- النظر في التقديرات القضائية المرفقة بحسب ما تراه عدالة المحكمة.
- إلزامه بالفوائد القانونية والتعويض عن التأخير في السداد.
- إلزامه بالرسوم والمصاريف وأتعاب المحاماة.

وتفضلوا بقبول فائق الاحترام والتقدير.

مقدمه:
الاسم: ${input.employee_name || "................"}
التوقيع: ................
التاريخ: ${today}
`;
}

export function LegalClaimDialog({ open, onOpenChange, input, result }: LegalClaimDialogProps) {
  const [text, setText] = useState("");
  const { data: refs } = useApprovedLegalReferences();

  useEffect(() => {
    if (open) setText(buildClaimTemplate(input, result, refs || []));
  }, [open, input, result, refs]);


  const print = () => {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
      <title>مطالبة قانونية - ${input.employee_name || ""}</title>
      <style>
        body { font-family: "Cairo","Tajawal","Amiri",Arial,sans-serif; padding: 40px 50px; line-height: 1.9; color: #212529; }
        pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
        h1 { text-align: center; font-size: 18px; border-bottom: 2px solid #0F5132; padding-bottom: 10px; }
      </style></head><body>
      <h1>مطالبة قانونية بالحقوق العمالية</h1>
      <pre>${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const downloadTxt = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `مطالبة-قانونية-${input.employee_name || "claim"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            مطالبة قانونية بالحقوق العمالية
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          يمكنك تعديل النص بحرية قبل الطباعة أو التحميل.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
          className="flex-1 font-sans text-sm leading-relaxed resize-none"
          dir="rtl"
        />
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={downloadTxt} className="gap-2">
            <Download className="h-4 w-4" /> تحميل نصي
          </Button>
          <Button onClick={print} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة / حفظ PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
