import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, ArrowRight, FileDown, FileText, ListChecks, Loader2 } from "lucide-react";
import {
  adminArchiveSaReport,
  adminListSaReports,
  adminSaCaseAudit,
  getSaReport,
} from "@/lib/saudi/report.functions";
import { downloadSaReportDocument } from "@/lib/saudi/report-render";

export const Route = createFileRoute("/_authenticated/_admin/admin/sa-reports")({
  component: SaReportsAdminPage,
  head: () => ({
    meta: [
      { title: "سجل التقارير السعودية | لوحة الإدارة" },
      { name: "description", content: "أرشيف التقارير النهائية للحقوق العمالية السعودية مع التدقيق وإعادة التنزيل." },
      { property: "og:title", content: "سجل التقارير السعودية" },
      { property: "og:description", content: "أرشيف التقارير النهائية مع بصمة التحقق وسجل التدقيق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

function SaReportsAdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListSaReports);
  const fetchOne = useServerFn(getSaReport);
  const archiveFn = useServerFn(adminArchiveSaReport);
  const auditFn = useServerFn(adminSaCaseAudit);

  const [search, setSearch] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [archived, setArchived] = useState(false);
  const [auditCase, setAuditCase] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filters = { search: search || undefined, planCode: planCode || undefined, from: from || undefined, to: to || undefined, archived };

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "sa-reports", filters],
    queryFn: () => list({ data: filters }),
  });

  const { data: audit } = useQuery({
    queryKey: ["admin", "sa-case-audit", auditCase],
    queryFn: () => auditFn({ data: { caseId: auditCase! } }),
    enabled: !!auditCase,
  });

  const archiveMut = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archiveFn({ data: v }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الأرشفة");
      qc.invalidateQueries({ queryKey: ["admin", "sa-reports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر التحديث"),
  });

  async function download(id: string) {
    setBusyId(id);
    try {
      const r = await fetchOne({ data: { id } });
      await downloadSaReportDocument(r.document, r.checksum);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر تنزيل التقرير");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> سجل التقارير السعودية</h1>
            <p className="text-sm text-muted-foreground">أرشيف التقارير النهائية غير القابلة للتعديل مع بصمة التحقق وسجل التدقيق.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1"><Link to="/admin"><ArrowRight className="h-4 w-4" /> اللوحة</Link></Button>
        </div>

        <Card className="p-4 grid gap-3 md:grid-cols-5">
          <Input placeholder="بحث برقم التقرير أو الاسم" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input placeholder="كود الباقة (single/monthly/yearly)" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant={archived ? "default" : "outline"} onClick={() => setArchived((v) => !v)} className="gap-1">
            <Archive className="h-4 w-4" /> {archived ? "المؤرشفة" : "النشطة"}
          </Button>
        </Card>

        <Card className="p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground">لا توجد تقارير مطابقة.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r: any) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold" dir="ltr">{r.report_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.employee_label} — {r.employer_label} • <span dir="ltr">{new Date(r.created_at).toLocaleString("en-GB")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{r.plan_code}</Badge>
                      <Badge variant="outline">إصدار {r.version}</Badge>
                      <span className="font-mono" dir="ltr">{money(Number(r.net_total))} {r.currency}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span dir="ltr">بصمة: {String(r.checksum).slice(0, 20)}…</span>
                    <span>مرات التنزيل: {r.downloads}</span>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => download(r.id)} disabled={busyId === r.id}>
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} تنزيل
                    </Button>
                    {r.case_id && (
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setAuditCase(auditCase === r.case_id ? null : r.case_id)}>
                        <ListChecks className="h-3.5 w-3.5" /> سجل التدقيق
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => archiveMut.mutate({ id: r.id, archived: !r.archived })}
                    >
                      {r.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      {r.archived ? "استرجاع" : "أرشفة"}
                    </Button>
                  </div>
                  {auditCase === r.case_id && (
                    <div className="mt-2 rounded-md border bg-muted/40 p-2 space-y-1 text-[11px]">
                      {(audit ?? []).map((a: any) => (
                        <p key={a.id}>
                          <span className="font-semibold">{a.step}:</span> {a.decision} — {a.reason}
                        </p>
                      ))}
                      {!audit?.length && <p className="text-muted-foreground">لا توجد قيود تدقيق.</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
