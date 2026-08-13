import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { money } from "@/lib/saudi/salary";
import {
  MONTHS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PROOF_TYPES,
  analyzeUnpaid,
  emptyUnpaidRow,
  rowPaidAmount,
  rowRemaining,
  rowStatusLabel,
  validateUnpaid,
  type PaymentStatus,
  type UnpaidRow,
} from "@/lib/saudi/unpaidSalaries";

export const Route = createFileRoute("/_authenticated/sa/unpaid-salaries")({
  head: () => ({
    meta: [
      { title: "الرواتب المتأخرة والمبالغ غير المسددة — الخطوة 6 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة السادسة: حصر الرواتب والمستحقات غير المسددة، وإثبات السداد، واستبعاد المبالغ المسددة من المطالبة النهائية.",
      },
      { property: "og:title", content: "الرواتب المتأخرة والمبالغ غير المسددة — الخطوة 6" },
      {
        property: "og:description",
        content: "حصر المستحقات غير المسددة مع التحقق من إثباتات السداد واحتساب المتبقي تلقائياً.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnpaidSalariesStep,
});

function UnpaidSalariesStep() {
  const draft = useCaseDraft("SA", 6);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [hasUnpaid, setHasUnpaid] = useState<boolean | null>(null);
  const [rows, setRows] = useState<UnpaidRow[]>([]);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);

  const types = useQuery({
    queryKey: ["unpaid-salary-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unpaid_salary_types")
        .select("code,name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-currency", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_salaries")
        .select("currency")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const currency = salary.data?.currency || "SAR";

  const saved = useQuery({
    queryKey: ["case-unpaid-salaries", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_unpaid_salaries")
        .select("*")
        .eq("case_id", caseId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!saved.data) return;
    if (saved.data.length) {
      setHasUnpaid(true);
      setRows(
        saved.data.map((r) => ({
          id: r.id,
          month: (r.month as number) ?? "",
          year: (r.year as number) ?? "",
          due_date: r.due_date ?? "",
          salary_type: r.salary_type ?? "monthly_salary",
          amount: r.amount == null ? "" : Number(r.amount),
          currency: r.currency ?? "SAR",
          payment_status: (r.payment_status as PaymentStatus) ?? "unpaid",
          paid_amount: r.paid_amount == null ? "" : Number(r.paid_amount),
          payment_date: r.payment_date ?? "",
          payment_method: r.payment_method ?? "",
          proof_type: r.proof_type ?? "",
          proof_file: r.proof_file ?? "",
          notes: r.notes ?? "",
        })),
      );
    }
  }, [saved.data]);

  const analysis = useMemo(() => analyzeUnpaid(rows, currency), [rows, currency]);
  const errors = useMemo(
    () => (hasUnpaid ? validateUnpaid(rows, { currency }) : []),
    [rows, currency, hasUnpaid],
  );
  const valid = errors.length === 0;

  const setRow = (i: number, patch: Partial<UnpaidRow>) =>
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((list) => [...list, emptyUnpaidRow(currency)]);
  const removeRow = (i: number) => setRows((list) => list.filter((_, idx) => idx !== i));

  const uploadProof = async (i: number, file: File) => {
    try {
      setUploading(i);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from("case-proofs").upload(path, file, {
        upsert: true,
      });
      if (error) throw error;
      setRow(i, { proof_file: path });
      toast.success("تم رفع إثبات السداد");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر رفع الإثبات");
    } finally {
      setUploading(null);
    }
  };

  const openProof = async (path: string, download = false) => {
    const { data, error } = await supabase.storage
      .from("case-proofs")
      .createSignedUrl(path, 300, download ? { download: true } : undefined);
    if (error || !data?.signedUrl) {
      toast.error("تعذّر فتح الإثبات");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");
      await supabase.from("case_unpaid_salaries").delete().eq("case_id", caseId);
      if (hasUnpaid && rows.length) {
        const { error } = await supabase.from("case_unpaid_salaries").insert(
          rows.map((r, i) => ({
            case_id: caseId,
            month: r.month === "" ? null : Number(r.month),
            year: r.year === "" ? null : Number(r.year),
            due_date: r.due_date || null,
            salary_type: r.salary_type,
            amount: Number(r.amount) || 0,
            currency: r.currency || currency,
            payment_status: r.payment_status,
            paid_amount: rowPaidAmount(r),
            remaining_amount: rowRemaining(r),
            payment_date: r.payment_date || null,
            payment_method: r.payment_method || null,
            proof_type: r.proof_type || null,
            proof_file: r.proof_file || null,
            notes: r.notes || null,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }
      await draft.saveNowWith({
        unpaid_salaries: {
          has_unpaid: !!hasUnpaid,
          analysis,
          currency,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ المستحقات غير المسددة"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (hasUnpaid === null) {
      toast.error("يرجى الإجابة على السؤال أولاً");
      return;
    }
    if (hasUnpaid && !rows.length) {
      toast.error("أضف سجلاً واحداً على الأقل أو اختر «لا»");
      return;
    }
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ المستحقات غير المسددة وإعادة احتساب المطالبة");
    if (thenNext) navigate({ to: "/sa/annual-leave" });
  };

  const typeName = (code: string) =>
    types.data?.find((t) => t.code === code)?.name ?? code;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Wallet className="h-3.5 w-3.5" /> الخطوة 6 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            الرواتب المتأخرة والمبالغ غير المسددة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُستبعد المبالغ التي ثبت سدادها من المطالبة، ويُضاف المتبقي فقط إلى إجمالي المستحقات.
          </p>
        </div>

        {(draft.loading || saved.isLoading) && (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </Card>
        )}

        {!draft.loading && !caseId && (
          <Card className="p-8 text-center">
            <h2 className="mb-1 font-bold">أكمل الخطوات السابقة أولاً</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              يجب إنشاء القضية وإدخال بيانات الراتب قبل هذه الخطوة.
            </p>
            <Button asChild className="gap-2">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
          </Card>
        )}

        {!!caseId && !saved.isLoading && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-3 font-bold">هل توجد رواتب أو مستحقات مالية لم يتم سدادها؟</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={hasUnpaid === true ? "default" : "outline"}
                  onClick={() => {
                    setHasUnpaid(true);
                    if (!rows.length) addRow();
                  }}
                >
                  نعم
                </Button>
                <Button
                  variant={hasUnpaid === false ? "default" : "outline"}
                  onClick={() => {
                    setHasUnpaid(false);
                    setRows([]);
                  }}
                >
                  لا
                </Button>
              </div>
              {hasUnpaid === false && (
                <p className="mt-3 text-sm text-muted-foreground">
                  لا توجد مستحقات غير مسددة — يمكنك الحفظ والانتقال إلى الخطوة التالية.
                </p>
              )}
            </Card>

            {hasUnpaid && (
              <>
                {rows.map((row, i) => {
                  const remaining = rowRemaining(row);
                  const hasProof = !!row.proof_file || !!row.proof_type;
                  return (
                    <Card key={i} className="space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold">سجل {i + 1}</h3>
                        <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => removeRow(i)}>
                          <Trash2 className="h-4 w-4" /> حذف
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label>الشهر</Label>
                          <Select
                            value={row.month === "" ? "" : String(row.month)}
                            onValueChange={(v) => setRow(i, { month: Number(v) })}
                          >
                            <SelectTrigger><SelectValue placeholder="اختر الشهر" /></SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((m, idx) => (
                                <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>السنة</Label>
                          <Input
                            type="number"
                            value={row.year}
                            onChange={(e) => setRow(i, { year: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>تاريخ الاستحقاق</Label>
                          <Input type="date" value={row.due_date} onChange={(e) => setRow(i, { due_date: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label>نوع المستحق</Label>
                          <Select value={row.salary_type} onValueChange={(v) => setRow(i, { salary_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(types.data ?? []).map((t) => (
                                <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>القيمة</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => setRow(i, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>العملة</Label>
                          <Input value={row.currency} onChange={(e) => setRow(i, { currency: e.target.value.toUpperCase() })} />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label>هل تم السداد؟</Label>
                          <Select
                            value={row.payment_status}
                            onValueChange={(v) => setRow(i, { payment_status: v as PaymentStatus })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PAYMENT_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {row.payment_status === "partial" && (
                          <div>
                            <Label>القيمة المسددة</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.paid_amount}
                              onChange={(e) =>
                                setRow(i, { paid_amount: e.target.value === "" ? "" : Number(e.target.value) })
                              }
                            />
                          </div>
                        )}
                        {row.payment_status !== "unpaid" && (
                          <>
                            <div>
                              <Label>تاريخ السداد</Label>
                              <Input
                                type="date"
                                value={row.payment_date}
                                onChange={(e) => setRow(i, { payment_date: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>طريقة السداد</Label>
                              <Select
                                value={row.payment_method}
                                onValueChange={(v) => setRow(i, { payment_method: v })}
                              >
                                <SelectTrigger><SelectValue placeholder="اختر الطريقة" /></SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>نوع إثبات السداد</Label>
                              <Select value={row.proof_type} onValueChange={(v) => setRow(i, { proof_type: v })}>
                                <SelectTrigger><SelectValue placeholder="اختر الإثبات" /></SelectTrigger>
                                <SelectContent>
                                  {PROOF_TYPES.map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>ملف الإثبات</Label>
                              <Input
                                type="file"
                                disabled={uploading === i}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void uploadProof(i, f);
                                }}
                              />
                              {row.proof_file && (
                                <div className="mt-2 flex gap-2">
                                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void openProof(row.proof_file)}>
                                    <Eye className="h-3.5 w-3.5" /> عرض
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void openProof(row.proof_file, true)}>
                                    <Download className="h-3.5 w-3.5" /> تنزيل
                                  </Button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea value={row.notes} onChange={(e) => setRow(i, { notes: e.target.value })} />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                        <Badge variant="outline">{typeName(row.salary_type)}</Badge>
                        <span>المتبقي: <strong>{money(remaining)} {row.currency}</strong></span>
                        <Badge variant={remaining > 0 ? "destructive" : "secondary"}>{rowStatusLabel(row)}</Badge>
                      </div>

                      {row.payment_status !== "unpaid" && !hasProof && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>تنبيه قانوني</AlertTitle>
                          <AlertDescription>
                            تم إدخال وجود سداد دون وجود إثبات، وقد يكون هذا محل نظر أمام الجهة القضائية. لن يُستبعد
                            المبلغ من المطالبة.
                          </AlertDescription>
                        </Alert>
                      )}
                    </Card>
                  );
                })}

                <Button variant="outline" className="gap-2" onClick={addRow}>
                  <Plus className="h-4 w-4" /> إضافة راتب أو مبلغ مستحق
                </Button>

                <Card className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-right">
                      <tr>
                        <th className="p-3">الشهر</th>
                        <th className="p-3">السنة</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3">المستحق</th>
                        <th className="p-3">المسدد</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3">{r.month === "" ? "—" : MONTHS[Number(r.month) - 1]}</td>
                          <td className="p-3">{r.year || "—"}</td>
                          <td className="p-3">{typeName(r.salary_type)}</td>
                          <td className="p-3">{money(r.amount)}</td>
                          <td className="p-3">{money(r.paid)}</td>
                          <td className="p-3 font-semibold">{money(r.remaining)}</td>
                          <td className="p-3">{r.status}</td>
                        </tr>
                      ))}
                      {!analysis.rows.length && (
                        <tr><td className="p-4 text-muted-foreground" colSpan={7}>لا توجد سجلات بعد.</td></tr>
                      )}
                    </tbody>
                  </table>
                </Card>

                <Card className="grid gap-4 p-6 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي المستحقات المدخلة</p>
                    <p className="text-lg font-bold">{money(analysis.totalDue)} {currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">المستبعد لثبوت السداد</p>
                    <p className="text-lg font-bold">{money(analysis.totalPaidProven)} {currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي المتبقي (يُضاف للمطالبة)</p>
                    <p className="text-lg font-bold text-primary">{money(analysis.totalRemaining)} {currency}</p>
                  </div>
                </Card>

                {analysis.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تحذيرات</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pr-5">
                        {analysis.warnings.map((w) => <li key={w}>{w}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {touched && errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>يرجى تصحيح الأخطاء</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pr-5">
                        {errors.map((e) => <li key={e}>{e}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => void submit(false)} disabled={save.isPending}>
                <Save className="h-4 w-4" /> حفظ
              </Button>
              <Button className="gap-2" onClick={() => void submit(true)} disabled={save.isPending}>
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" className="gap-2">
                <Link to="/sa/working-hours">
                  <ChevronRight className="h-4 w-4" /> رجوع إلى الخطوة 5
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>
      <ContactBar />
      <FooterAttribution />
    </div>
  );
}
