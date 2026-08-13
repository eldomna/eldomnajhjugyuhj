import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { ContractFormDialog } from "@/components/saudi/ContractFormDialog";
import {
  analyzeContracts,
  effectiveEnd,
  fmtDate,
  formatDuration,
  type Contract,
  type ContractDraft,
} from "@/lib/saudi/contracts";

export const Route = createFileRoute("/_authenticated/sa/contracts")({
  head: () => ({
    meta: [
      { title: "بيانات العقود — الخطوة 2 • حاسبة العمال الذكية" },
      { name: "description", content: "إدارة عقود العامل بعدد غير محدود وتحليل الاتصال والانقطاع والتجديد وتطبيق المادة (55) من نظام العمل السعودي." },
      { property: "og:title", content: "بيانات العقود — الخطوة 2" },
      { property: "og:description", content: "إضافة وتعديل ونسخ عقود العامل مع تحليل تلقائي لمدة الخدمة واتصالها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContractsStep,
});

type Row = Contract & { deleted_at: string | null };

function ContractsStep() {
  const draft = useCaseDraft("SA", 2);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const caseId = draft.draftId;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; value: ContractDraft } | null>(null);
  const [details, setDetails] = useState<Contract | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contract | null>(null);
  const [askAnother, setAskAnother] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  const list = useQuery({
    queryKey: ["case-contracts", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from("case_contracts")
        .select("*")
        .eq("case_id", caseId!)
        .is("deleted_at", null)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        ...r,
        renew_history: Array.isArray(r.renew_history) ? r.renew_history : [],
      })) as Contract[];

    },
  });

  const contracts = list.data ?? [];
  const analysis = useMemo(
    () => analyzeContracts(contracts, draft.info.nationality || ""),
    [contracts, draft.info.nationality],
  );

  const refreshAnalysis = async () => {
    await qc.invalidateQueries({ queryKey: ["case-contracts", caseId] });
    setAnalysisReady(false);
  };

  const save = useMutation({
    mutationFn: async ({ id, value }: { id?: string; value: ContractDraft }) => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة — أكمل الخطوة الأولى أولاً");
      const payload = {
        case_id: caseId,
        contract_number: value.contract_number.trim(),
        contract_name: value.contract_name?.trim() || null,
        start_date: value.start_date,
        end_date: value.end_date,
        joining_date: value.joining_date,
        contract_type: value.contract_type,
        is_qiwa_documented: value.is_qiwa_documented,
        qiwa_contract_number: value.qiwa_contract_number,
        renewed: value.renewed,
        renew_count: value.renewed ? value.renew_count : 0,
        renew_history: value.renewed ? value.renew_history : [],
        ended: value.ended,
        end_reason: value.ended ? value.end_reason : null,
        actual_end_date: value.ended ? value.actual_end_date : null,
        sort_order: contracts.length,
      };
      if (id) {
        const { error } = await supabase.from("case_contracts").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("case_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async (_d, vars) => {
      toast.success(vars.id ? "تم تعديل العقد وإعادة التحليل" : "تم حفظ العقد");
      await refreshAnalysis();
      if (!vars.id) setAskAnother(true);
    },
    onError: (e: any) =>
      toast.error(
        String(e?.message ?? "").includes("case_contracts_unique_number")
          ? "رقم العقد مستخدم بالفعل في هذه القضية"
          : (e?.message ?? "تعذّر حفظ العقد"),
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("case_contracts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حذف العقد وإعادة التحليل");
      await refreshAnalysis();
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حذف العقد"),
  });

  const toDraft = (c: Contract): ContractDraft => ({
    contract_number: c.contract_number,
    contract_name: c.contract_name,
    start_date: c.start_date,
    end_date: c.end_date,
    joining_date: c.joining_date,
    contract_type: c.contract_type,
    is_qiwa_documented: c.is_qiwa_documented,
    qiwa_contract_number: c.qiwa_contract_number,
    renewed: c.renewed,
    renew_count: c.renew_count,
    renew_history: c.renew_history,
    ended: c.ended,
    end_reason: c.end_reason,
    actual_end_date: c.actual_end_date,
  });

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Contract) => {
    setEditing({ id: c.id, value: toDraft(c) });
    setFormOpen(true);
  };
  const openCopy = (c: Contract) => {
    setEditing({
      value: {
        ...toDraft(c),
        contract_number: `${c.contract_number}-نسخة`,
        start_date: "",
        end_date: null,
        joining_date: null,
        ended: false,
        end_reason: null,
        actual_end_date: null,
      },
    });
    setFormOpen(true);
  };

  const finalChecks = useMemo(() => {
    const checks = [
      { ok: contracts.length >= 1, label: "وجود عقد واحد على الأقل" },
      { ok: !list.isError, label: "نجاح حفظ وتحميل جميع العقود" },
      { ok: contracts.length >= 1 && analysis.errors.length === 0, label: "نجاح تحليل العقود ومدة الخدمة" },
      { ok: analysis.errors.every((e) => !e.includes("تاريخ")), label: "عدم وجود أخطاء في التواريخ" },
      { ok: !analysis.errors.some((e) => e.startsWith("تعارض")), label: "عدم وجود تعارض بين العقود" },
      { ok: !!analysis.current || analysis.endedContracts.length > 0, label: "نجاح تحديد العقد الحالي" },
      { ok: !!analysis.last, label: "نجاح تحديد العقد الأخير" },
      {
        ok: !analysis.article55.applies || analysis.article55.legalType !== null,
        label: "نجاح تطبيق قواعد المادة (55) عند انطباقها",
      },
    ];
    return { checks, allOk: checks.every((c) => c.ok) };
  }, [contracts.length, list.isError, analysis]);

  const goNext = async () => {
    if (!finalChecks.allOk) {
      toast.error("لا يمكن الانتقال قبل نجاح جميع عمليات التحقق");
      return;
    }
    const ok = await draft.saveNowWith({
      contracts_analysis: {
        count: analysis.count,
        first_contract: analysis.first?.contract_number ?? null,
        last_contract: analysis.last?.contract_number ?? null,
        current_contract: analysis.current?.contract_number ?? null,
        active_count: analysis.activeCount,
        ended_count: analysis.endedContracts.length,
        actual_service_days: analysis.actualServiceDays,
        legal_service_days: analysis.legalServiceDays,
        total_gap_days: analysis.totalGapDays,
        gaps: analysis.gaps,
        service_continuity: analysis.serviceContinuity,
        total_renewals: analysis.totalRenewals,
        renewal_months: analysis.renewalMonths,
        article_55: analysis.article55,
      },
    });
    if (!ok) {
      toast.error("تعذّر حفظ نتائج التحليل، أعد المحاولة");
      return;
    }
    toast.success("تم حفظ نتائج تحليل العقود");
    navigate({ to: "/sa/trial-periods" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <ScrollText className="h-3.5 w-3.5" /> الخطوة 2 من المعالج القانوني الذكي
            </div>
            <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">🇸🇦 بيانات العقود</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أضف عدداً غير محدود من العقود. يعيد النظام التحليل بالكامل بعد أي تعديل أو حذف.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1" onClick={() => void refreshAnalysis()}>
              <RefreshCw className="h-4 w-4" /> إعادة التحليل
            </Button>
            <Button className="gap-1" onClick={openAdd} disabled={!caseId}>
              <Plus className="h-4 w-4" /> إضافة عقد جديد
            </Button>
          </div>
        </div>

        {draft.loading && (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </Card>
        )}

        {!draft.loading && !caseId && (
          <Card className="p-8 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-1 font-bold">لم تُسجّل بيانات القضية بعد</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              أكمل الخطوة الأولى (بيانات القضية) لتتمكن من إضافة العقود.
            </p>
            <Button asChild className="gap-2">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
          </Card>
        )}

        {!draft.loading && caseId && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* قائمة العقود */}
            <div className="space-y-4 lg:col-span-3">
              {list.isLoading && (
                <Card className="space-y-3 p-6">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </Card>
              )}

              {list.isError && (
                <Card className="p-8 text-center">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
                  <p className="mb-4 text-sm text-muted-foreground">
                    {(list.error as Error)?.message ?? "تعذّر تحميل العقود"}
                  </p>
                  <Button variant="outline" className="gap-2" onClick={() => void list.refetch()}>
                    <RefreshCw className="h-4 w-4" /> إعادة المحاولة
                  </Button>
                </Card>
              )}

              {!list.isLoading && !list.isError && contracts.length === 0 && (
                <Card className="p-8 text-center">
                  <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="mb-1 font-bold">لا توجد عقود مضافة</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    ابدأ بإضافة العقد الأول للعامل — يمكنك إضافة أي عدد من العقود.
                  </p>
                  <Button className="gap-2" onClick={openAdd}>
                    <Plus className="h-4 w-4" /> إضافة عقد جديد
                  </Button>
                </Card>
              )}

              {analysis.ordered.map((c, i) => {
                const isCurrent = analysis.current?.id === c.id;
                return (
                  <Card
                    key={c.id}
                    className={`p-5 ${i === focusIndex ? "border-primary" : ""}`}
                    onClick={() => setFocusIndex(i)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <p className="font-bold">
                            عقد رقم {c.contract_number}
                            {c.contract_name ? ` — ${c.contract_name}` : ""}
                          </p>
                          <Badge variant={c.contract_type === "indefinite" ? "secondary" : "outline"}>
                            {c.contract_type === "indefinite" ? "غير محدد المدة" : "محدد المدة"}
                          </Badge>
                          {isCurrent && <Badge>ساري</Badge>}
                          {c.ended && <Badge variant="destructive">منتهٍ</Badge>}
                          {c.is_qiwa_documented && <Badge variant="outline">موثق في قوى</Badge>}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {fmtDate(c.start_date)} → {fmtDate(effectiveEnd(c))} • المدة:{" "}
                          {formatDuration(analysis.perContractDays[c.id] ?? 0)}
                          {c.renewed ? ` • تجديدات: ${c.renew_count}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setDetails(c)}>
                          <Eye className="h-3.5 w-3.5" /> التفاصيل
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" /> تعديل
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openCopy(c)}>
                          <Copy className="h-3.5 w-3.5" /> نسخ
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          onClick={() => setConfirmDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {analysis.count > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={focusIndex === 0}
                    onClick={() => setFocusIndex((i) => Math.max(0, i - 1))}
                    className="gap-1"
                  >
                    <ChevronRight className="h-4 w-4" /> العقد السابق
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    العقد {focusIndex + 1} من {analysis.count}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={focusIndex >= analysis.count - 1}
                    onClick={() => setFocusIndex((i) => Math.min(analysis.count - 1, i + 1))}
                    className="gap-1"
                  >
                    العقد التالي <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* لوحة التحليل */}
            <div className="space-y-4 lg:col-span-2">
              <Card className="p-5">
                <h2 className="mb-4 flex items-center gap-2 font-bold">
                  <Info className="h-4 w-4 text-primary" /> تحليل العقود
                </h2>
                {contracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">أضف عقداً لبدء التحليل.</p>
                ) : (
                  <dl className="space-y-2 text-sm">
                    <Fact label="عدد العقود" value={String(analysis.count)} />
                    <Fact label="أول عقد" value={analysis.first?.contract_number ?? "—"} />
                    <Fact label="آخر عقد" value={analysis.last?.contract_number ?? "—"} />
                    <Fact label="العقد الساري" value={analysis.current?.contract_number ?? "لا يوجد"} />
                    <Fact label="العقود المنتهية" value={String(analysis.endedContracts.length)} />
                    <Fact label="إجمالي مدة العقود" value={formatDuration(analysis.totalContractsDays)} />
                    <Fact label="مدة الخدمة الفعلية" value={formatDuration(analysis.actualServiceDays)} />
                    <Fact label="مدة الخدمة النظامية" value={formatDuration(analysis.legalServiceDays)} />
                    <Fact label="عدد مرات التجديد" value={String(analysis.totalRenewals)} />
                    <Fact label="إجمالي مدد التجديد" value={`${analysis.renewalMonths} شهر`} />
                    <Fact
                      label="اتصال الخدمة"
                      value={analysis.serviceContinuity === "continuous" ? "خدمة متصلة" : "خدمة منفصلة"}
                    />
                    <Fact label="أيام الانقطاع" value={`${analysis.totalGapDays} يوم`} />
                  </dl>
                )}
              </Card>

              {analysis.gaps.length > 0 && (
                <Card className="p-5">
                  <h3 className="mb-3 font-bold">فترات الانقطاع</h3>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {analysis.gaps.map((g, i) => (
                      <li key={i} className="rounded-md border p-2">
                        بين العقد {g.afterContract} والعقد {g.beforeContract}: {g.days} يوم — من{" "}
                        {fmtDate(g.from)} إلى {fmtDate(g.to)}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {analysis.article55.applies && (
                <Alert variant={analysis.article55.triggered ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {analysis.article55.triggered
                      ? "قد يعتبر العقد عقداً غير محدد المدة وفق المادة (55)"
                      : "المادة (55) قابلة للتطبيق — لم تتحقق شروط التحول بعد"}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    <ul className="mt-1 list-disc space-y-1 pe-4">
                      {analysis.article55.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      نوع العقد الأصلي:{" "}
                      {analysis.article55.originalType === "indefinite" ? "غير محدد المدة" : "محدد المدة"} — النوع
                      النظامي بعد التحليل:{" "}
                      {analysis.article55.legalType === "indefinite" ? "غير محدد المدة" : "محدد المدة"} (لا يتم تغيير
                      بيانات العقد الأصلية).
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {!analysis.article55.applies && contracts.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>قواعد التحول</AlertTitle>
                  <AlertDescription className="text-xs">
                    {analysis.article55.reasons[0] ??
                      "لا تنطبق قواعد المادة (55) على هذه الحالة وفق البيانات المدخلة."}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-5">
                <h3 className="mb-3 font-bold">التحقق النهائي</h3>
                <ul className="space-y-2 text-xs">
                  {finalChecks.checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2">
                      {c.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={c.ok ? "" : "text-destructive"}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {analysis.errors.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pe-4 text-xs text-destructive">
                    {analysis.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {caseId && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="gap-1">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> السابق: بيانات القضية
              </Link>
            </Button>
            <Button className="gap-2" disabled={!finalChecks.allOk || save.isPending} onClick={() => void goNext()}>
              التالي: فترة التجربة <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-card/50">
        <div className="container mx-auto px-4 py-4 text-center">
          <FooterAttribution />
          <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
            <ContactBar className="mb-3" />
            <p>© {new Date().getFullYear()} حاسبة العمال الذكية</p>
          </div>
        </div>
      </footer>

      <ContractFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing?.value ?? null}
        editingId={editing?.id}
        others={contracts}
        saving={save.isPending}
        onSubmit={async (value) => {
          try {
            await save.mutateAsync({ id: editing?.id, value });
            return true;
          } catch {
            return false;
          }
        }}
      />

      {/* تفاصيل العقد */}
      <Dialog open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد {details?.contract_number}</DialogTitle>
          </DialogHeader>
          {details && (
            <dl className="space-y-2 text-sm">
              <Fact label="اسم العقد" value={details.contract_name || "—"} />
              <Fact label="نوع العقد" value={details.contract_type === "indefinite" ? "غير محدد المدة" : "محدد المدة"} />
              <Fact label="تاريخ البداية" value={fmtDate(details.start_date)} />
              <Fact label="تاريخ النهاية" value={fmtDate(details.end_date)} />
              <Fact label="تاريخ المباشرة" value={fmtDate(details.joining_date)} />
              <Fact label="موثق في قوى" value={details.is_qiwa_documented ? "نعم" : "لا"} />
              <Fact label="رقم عقد قوى" value={details.qiwa_contract_number || "—"} />
              <Fact label="تم التجديد" value={details.renewed ? `نعم (${details.renew_count})` : "لا"} />
              {details.renewed &&
                details.renew_history.map((r, i) => (
                  <Fact key={i} label={`التجديد ${i + 1}`} value={`${fmtDate(r.date)} — ${r.months} شهر`} />
                ))}
              <Fact label="منتهٍ" value={details.ended ? "نعم" : "لا"} />
              <Fact label="سبب الانتهاء" value={details.end_reason || "—"} />
              <Fact label="تاريخ الانتهاء" value={fmtDate(details.actual_end_date)} />
              <Fact label="المدة المحتسبة" value={formatDuration(analysis.perContractDays[details.id] ?? 0)} />
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العقد {confirmDelete?.contract_number}؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم استبعاد العقد من التحليل وإعادة حساب مدة الخدمة والاتصال والانقطاع والتجديد والمادة (55).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) remove.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* إضافة عقد آخر؟ */}
      <AlertDialog open={askAnother} onOpenChange={setAskAnother}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل تريد إضافة عقد آخر؟</AlertDialogTitle>
            <AlertDialogDescription>
              يمكنك إضافة أي عدد من العقود، أو الانتقال إلى مرحلة تحليل العقود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setAskAnother(false);
                setAnalysisReady(true);
              }}
            >
              لا، انتقل للتحليل
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAskAnother(false);
                openAdd();
              }}
            >
              نعم، إضافة عقد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {analysisReady && null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
