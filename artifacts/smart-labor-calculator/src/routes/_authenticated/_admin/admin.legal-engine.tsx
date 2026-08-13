import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Scale, Plus, Upload, RotateCcw, Copy, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import {
  RULE_TYPE_LABELS,
  RULE_STATUS_LABELS,
  APPROVAL_STAGES,
  validateRule,
  canPublish,
  buildDependencyGraph,
  validateFormulaExpression,
  type LegalRuleRow,
  type FormulaRow,
  type RuleConditionRow,
  type RuleExceptionRow,
  type RuleType,
} from "@/lib/legal/rulesEngine";

export const Route = createFileRoute("/_authenticated/_admin/admin/legal-engine")({
  head: () => ({
    meta: [
      { title: "محرك إدارة القوانين والدول | حاسبة العمال الذكية" },
      { name: "description", content: "إدارة الدول والأنظمة والمواد والقواعد والمعادلات والاستثناءات والإصدارات والنشر." },
    ],
  }),
  component: LegalEnginePage,
});

type CountryRow = {
  code: string;
  name_ar: string;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  employment_law_name: string | null;
  social_insurance_law: string | null;
  legislator: string | null;
  status: string | null;
  is_active: boolean;
  updated_at: string;
};

type SystemRow = {
  id: string;
  country_code: string;
  system_code: string;
  system_name: string;
  system_type: string;
  version: string;
  effective_date: string;
  expiry_date: string | null;
  authority: string | null;
  status: string;
};

type ArticleRow = {
  id: string;
  country_code: string;
  article_number: string;
  article_title: string;
  article_text: string;
  version: string;
  effective_date: string;
  status: string;
};

function LegalEnginePage() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("SA");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [ruleDialog, setRuleDialog] = useState(false);
  const [selected, setSelected] = useState<LegalRuleRow | null>(null);

  const [ruleForm, setRuleForm] = useState({
    rule_code: "",
    rule_name: "",
    rule_type: "calculation" as RuleType,
    claim_type: "",
    sector: "",
    worker_type: "",
    contract_type: "",
    priority: 100,
    specificity: 0,
    formula_id: "",
    article_id: "",
    system_id: "",
    value: "{}",
    description: "",
    version: "1.0",
    effective_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["legal-engine", country],
    queryFn: async () => {
      const [countries, systems, articles, formulas, rules, conditions, exceptions, audit, approvals] =
        await Promise.all([
          supabase.from("countries").select("*").order("sort_order"),
          supabase.from("legal_systems").select("*").order("country_code"),
          supabase.from("legal_articles").select("*").eq("country_code", country).order("article_number"),
          supabase.from("rule_formulas").select("*").order("formula_code"),
          supabase.from("legal_rules").select("*").eq("country_code", country).order("rule_code"),
          supabase.from("rule_conditions").select("*").order("execution_order"),
          supabase.from("rule_exceptions").select("*").eq("country_code", country).order("priority", { ascending: false }),
          supabase.from("rule_audit_log").select("*").order("changed_at", { ascending: false }).limit(200),
          supabase.from("rule_approvals").select("*"),
        ]);
      return {
        countries: (countries.data ?? []) as unknown as CountryRow[],
        systems: (systems.data ?? []) as unknown as SystemRow[],
        articles: (articles.data ?? []) as unknown as ArticleRow[],
        formulas: (formulas.data ?? []) as unknown as FormulaRow[],
        rules: (rules.data ?? []) as unknown as LegalRuleRow[],
        conditions: (conditions.data ?? []) as unknown as RuleConditionRow[],
        exceptions: (exceptions.data ?? []) as unknown as RuleExceptionRow[],
        audit: audit.data ?? [],
        approvals: approvals.data ?? [],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["legal-engine"] });

  const graph = useMemo(
    () =>
      data
        ? buildDependencyGraph({
            rules: data.rules,
            formulas: data.formulas,
            articles: data.articles.map((a) => ({ id: a.id, article_number: a.article_number, status: a.status })),
            conditions: data.conditions,
            exceptions: data.exceptions,
          })
        : [],
    [data],
  );

  const issuesFor = (rule: LegalRuleRow) =>
    data
      ? validateRule(rule, {
          formula: data.formulas.find((f) => f.id === rule.formula_id) ?? null,
          hasArticle: Boolean(rule.article_id && data.articles.some((a) => a.id === rule.article_id)),
          conditions: data.conditions.filter((c) => c.rule_id === rule.id),
          siblings: data.rules,
        })
      : [];

  const saveRule = async () => {
    if (!ruleForm.rule_code || !ruleForm.rule_name) return toast.error("رمز القاعدة واسمها مطلوبان");
    let parsedValue: unknown = {};
    try {
      parsedValue = JSON.parse(ruleForm.value || "{}");
    } catch {
      return toast.error("قيم القاعدة ليست JSON صالحاً");
    }
    const { error } = await supabase.from("legal_rules").insert({
      country_code: country,
      system_id: ruleForm.system_id || null,
      rule_code: ruleForm.rule_code,
      rule_name: ruleForm.rule_name,
      rule_type: ruleForm.rule_type,
      claim_type: ruleForm.claim_type || null,
      sector: ruleForm.sector || null,
      worker_type: ruleForm.worker_type || null,
      contract_type: ruleForm.contract_type || null,
      priority: Number(ruleForm.priority) || 100,
      specificity: Number(ruleForm.specificity) || 0,
      formula_id: ruleForm.formula_id || null,
      article_id: ruleForm.article_id || null,
      value: parsedValue as never,
      description: ruleForm.description || null,
      version: ruleForm.version,
      effective_date: ruleForm.effective_date,
      expiry_date: ruleForm.expiry_date || null,
      status: "draft",
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء القاعدة كمسودة");
    setRuleDialog(false);
    invalidate();
  };

  const publish = async (rule: LegalRuleRow, scheduled?: string) => {
    const issues = issuesFor(rule);
    if (!canPublish(issues)) {
      return toast.error(`لا يمكن النشر: ${issues.filter((i) => i.severity === "error")[0]?.message}`);
    }
    const reason = window.prompt("سبب النشر / التعديل:") ?? undefined;
    const { error } = await supabase.rpc("publish_legal_rule", {
      _rule_id: rule.id,
      _reason: reason,
      _scheduled: scheduled,
    });
    if (error) return toast.error(error.message);
    toast.success(scheduled ? "تمت جدولة النشر" : "تم نشر القاعدة");
    invalidate();
  };

  const unpublish = async (rule: LegalRuleRow) => {
    const reason = window.prompt("سبب إلغاء النشر:") ?? undefined;
    const { error } = await supabase.rpc("unpublish_legal_rule", { _rule_id: rule.id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("تم إلغاء النشر");
    invalidate();
  };

  const rollback = async (rule: LegalRuleRow) => {
    const reason = window.prompt("سبب الرجوع للإصدار السابق:") ?? undefined;
    const { error } = await supabase.rpc("rollback_legal_rule", { _rule_id: rule.id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("تم الرجوع للإصدار السابق");
    invalidate();
  };

  const newVersion = async (rule: LegalRuleRow) => {
    const version = window.prompt("رقم الإصدار الجديد:", bumpVersion(rule.version));
    if (!version) return;
    const reason = window.prompt("سبب إنشاء الإصدار:") ?? undefined;
    const { error } = await supabase.rpc("new_rule_version", {
      _rule_id: rule.id,
      _version: version,
      _reason: reason,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء إصدار جديد كمسودة");
    invalidate();
  };

  const exportRules = () => {
    const payload = JSON.stringify({ country, exported_at: new Date().toISOString(), ...data }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `legal-rules-${country}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      permission="legal.manage"
      title="محرك إدارة القوانين والدول"
      description="مستودع تعريفي للقواعد والمعادلات والمواد والاستثناءات مع الإصدارات والاعتماد والنشر وسجل تدقيق غير قابل للحذف"
      icon={Scale}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(data?.countries ?? [{ code: "SA", name_ar: "السعودية" } as CountryRow]).map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="h-9 w-40" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button size="sm" variant="outline" onClick={exportRules}>
            <Download className="h-4 w-4 ml-1" /> تصدير
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="rules">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="rules">القواعد</TabsTrigger>
          <TabsTrigger value="countries">الدول</TabsTrigger>
          <TabsTrigger value="systems">الأنظمة</TabsTrigger>
          <TabsTrigger value="articles">المواد</TabsTrigger>
          <TabsTrigger value="formulas">المعادلات</TabsTrigger>
          <TabsTrigger value="exceptions">الاستثناءات</TabsTrigger>
          <TabsTrigger value="graph">الاعتماديات</TabsTrigger>
          <TabsTrigger value="audit">سجل التعديلات</TabsTrigger>
        </TabsList>

        {/* ---------------- Rules ---------------- */}
        <TabsContent value="rules">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-muted-foreground">
              القواعد السارية بتاريخ {asOf} — لا توجد أي معادلة أو نسبة داخل الكود البرمجي.
            </p>
            <Button size="sm" onClick={() => setRuleDialog(true)}><Plus className="h-4 w-4 ml-1" /> إضافة قاعدة</Button>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الرمز</th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الإصدار</th>
                  <th className="p-2 text-right">السريان</th>
                  <th className="p-2 text-right">الأولوية</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">التحقق</th>
                  <th className="p-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>}
                {(data?.rules ?? []).map((r) => {
                  const issues = issuesFor(r);
                  const errs = issues.filter((i) => i.severity === "error").length;
                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-2"><code className="text-xs">{r.rule_code}</code></td>
                      <td className="p-2">{r.rule_name}</td>
                      <td className="p-2 text-xs">{RULE_TYPE_LABELS[r.rule_type as RuleType] ?? r.rule_type}</td>
                      <td className="p-2">{r.version}</td>
                      <td className="p-2 text-xs">{r.effective_date}{r.expiry_date ? ` ← ${r.expiry_date}` : ""}</td>
                      <td className="p-2">{r.priority}</td>
                      <td className="p-2">
                        <Badge variant={r.status === "published" ? "default" : "outline"}>
                          {RULE_STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {errs ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> {errs}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <ShieldCheck className="h-3 w-3" /> سليمة
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>تفاصيل</Button>
                          <Button size="sm" variant="ghost" onClick={() => newVersion(r)}><Copy className="h-3.5 w-3.5" /></Button>
                          {r.status !== "published" ? (
                            <Button size="sm" variant="ghost" onClick={() => publish(r)}><Upload className="h-3.5 w-3.5" /></Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => unpublish(r)}>إلغاء النشر</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => rollback(r)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && (data?.rules ?? []).length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد قواعد لهذه الدولة</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- Countries ---------------- */}
        <TabsContent value="countries">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الدولة</th>
                  <th className="p-2 text-right">الرمز</th>
                  <th className="p-2 text-right">العملة</th>
                  <th className="p-2 text-right">المنطقة الزمنية</th>
                  <th className="p-2 text-right">اللغة</th>
                  <th className="p-2 text-right">نظام العمل</th>
                  <th className="p-2 text-right">نظام التأمينات</th>
                  <th className="p-2 text-right">جهة التشريع</th>
                  <th className="p-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(data?.countries ?? []).map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="p-2">{c.name_ar}</td>
                    <td className="p-2">{c.code}</td>
                    <td className="p-2">{c.currency ?? "—"}</td>
                    <td className="p-2 text-xs">
                      <EditableCell table="countries" idField="code" id={c.code} field="timezone" value={c.timezone} onSaved={invalidate} />
                    </td>
                    <td className="p-2 text-xs">
                      <EditableCell table="countries" idField="code" id={c.code} field="language" value={c.language} onSaved={invalidate} />
                    </td>
                    <td className="p-2 text-xs">
                      <EditableCell table="countries" idField="code" id={c.code} field="employment_law_name" value={c.employment_law_name} onSaved={invalidate} />
                    </td>
                    <td className="p-2 text-xs">
                      <EditableCell table="countries" idField="code" id={c.code} field="social_insurance_law" value={c.social_insurance_law} onSaved={invalidate} />
                    </td>
                    <td className="p-2 text-xs">
                      <EditableCell table="countries" idField="code" id={c.code} field="legislator" value={c.legislator} onSaved={invalidate} />
                    </td>
                    <td className="p-2">
                      <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status ?? "active"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- Systems ---------------- */}
        <TabsContent value="systems">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الدولة</th>
                  <th className="p-2 text-right">النظام</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الإصدار</th>
                  <th className="p-2 text-right">السريان</th>
                  <th className="p-2 text-right">الجهة</th>
                  <th className="p-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(data?.systems ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.country_code}</td>
                    <td className="p-2">{s.system_name}</td>
                    <td className="p-2 text-xs">{s.system_type}</td>
                    <td className="p-2">{s.version}</td>
                    <td className="p-2 text-xs">{s.effective_date}{s.expiry_date ? ` ← ${s.expiry_date}` : ""}</td>
                    <td className="p-2 text-xs">{s.authority ?? "—"}</td>
                    <td className="p-2"><Badge variant="outline">{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- Articles ---------------- */}
        <TabsContent value="articles">
          <div className="grid md:grid-cols-2 gap-3">
            {(data?.articles ?? []).map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-sm">المادة {a.article_number} — {a.article_title}</h3>
                  <Badge variant="outline">{a.version}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-6">{a.article_text}</p>
                <p className="text-[11px] text-muted-foreground mt-2">سارية من {a.effective_date}</p>
              </Card>
            ))}
            {(data?.articles ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مواد نظامية لهذه الدولة</p>
            )}
          </div>
        </TabsContent>

        {/* ---------------- Formulas ---------------- */}
        <TabsContent value="formulas">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الرمز</th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">التعبير</th>
                  <th className="p-2 text-right">المتغيرات</th>
                  <th className="p-2 text-right">الإصدار</th>
                  <th className="p-2 text-right">التحقق</th>
                </tr>
              </thead>
              <tbody>
                {(data?.formulas ?? []).map((f) => {
                  const vars = Array.isArray(f.variables) ? (f.variables as string[]) : [];
                  const check = validateFormulaExpression(f.formula_expression, vars);
                  return (
                    <tr key={f.id} className="border-t">
                      <td className="p-2"><code className="text-xs">{f.formula_code}</code></td>
                      <td className="p-2">{f.formula_name}</td>
                      <td className="p-2 text-xs" dir="ltr">{f.formula_expression}</td>
                      <td className="p-2 text-xs" dir="ltr">{vars.join(", ")}</td>
                      <td className="p-2">{f.version}</td>
                      <td className="p-2">
                        {check.valid ? (
                          <Badge variant="outline" className="text-green-600">صالحة</Badge>
                        ) : (
                          <Badge variant="destructive">{check.errors[0]}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- Exceptions ---------------- */}
        <TabsContent value="exceptions">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الاستثناء</th>
                  <th className="p-2 text-right">الفئة</th>
                  <th className="p-2 text-right">ينطبق على</th>
                  <th className="p-2 text-right">الأثر</th>
                  <th className="p-2 text-right">الأولوية</th>
                  <th className="p-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(data?.exceptions ?? []).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.exception_name}</td>
                    <td className="p-2 text-xs">{e.category}</td>
                    <td className="p-2 text-xs" dir="ltr">{JSON.stringify(e.applies_to)}</td>
                    <td className="p-2 text-xs" dir="ltr">{JSON.stringify(e.effect)}</td>
                    <td className="p-2">{e.priority}</td>
                    <td className="p-2"><Badge variant="outline">{e.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- Dependency graph ---------------- */}
        <TabsContent value="graph">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">القاعدة</th>
                  <th className="p-2 text-right">المعادلة</th>
                  <th className="p-2 text-right">المادة</th>
                  <th className="p-2 text-right">الشروط</th>
                  <th className="p-2 text-right">الاستثناءات</th>
                  <th className="p-2 text-right">حالة النشر</th>
                </tr>
              </thead>
              <tbody>
                {graph.map((n) => (
                  <tr key={n.ruleId} className="border-t">
                    <td className="p-2"><code className="text-xs">{n.ruleCode}</code></td>
                    <td className="p-2 text-xs">{n.formula ?? "—"}</td>
                    <td className="p-2 text-xs">{n.article ? `المادة ${n.article}` : "—"}</td>
                    <td className="p-2">{n.conditions}</td>
                    <td className="p-2">{n.exceptions}</td>
                    <td className="p-2">
                      {n.blocked.length ? (
                        <Badge variant="destructive">{n.blocked.join(" • ")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">جاهزة للنشر</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <p className="text-xs text-muted-foreground mb-3">
            سجل تدقيق غير قابل للتعديل أو الحذف — يشمل الإنشاء والتعديل والاعتماد والنشر والاسترجاع.
          </p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">القاعدة</th>
                  <th className="p-2 text-right">الإجراء</th>
                  <th className="p-2 text-right">من إصدار</th>
                  <th className="p-2 text-right">إلى إصدار</th>
                  <th className="p-2 text-right">السبب</th>
                  <th className="p-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(data?.audit ?? []).map((a) => {
                  const row = a as Record<string, unknown>;
                  return (
                    <tr key={String(row["id"])} className="border-t">
                      <td className="p-2"><code className="text-xs">{String(row["rule_code"] ?? "—")}</code></td>
                      <td className="p-2"><Badge variant="outline">{String(row["action"])}</Badge></td>
                      <td className="p-2">{String(row["old_version"] ?? "—")}</td>
                      <td className="p-2">{String(row["new_version"] ?? "—")}</td>
                      <td className="p-2 text-xs">{String(row["change_reason"] ?? "—")}</td>
                      <td className="p-2 text-xs">{new Date(String(row["changed_at"])).toLocaleString("ar-SA")}</td>
                    </tr>
                  );
                })}
                {(data?.audit ?? []).length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule details / approval workflow */}
      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.rule_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Row label="الرمز">{selected.rule_code}</Row>
              <Row label="النوع">{RULE_TYPE_LABELS[selected.rule_type as RuleType] ?? selected.rule_type}</Row>
              <Row label="القيم"><pre className="text-xs bg-muted p-2 rounded" dir="ltr">{JSON.stringify(selected.value, null, 2)}</pre></Row>
              <Row label="المادة القانونية">
                {data?.articles.find((a) => a.id === selected.article_id)?.article_title ?? "غير مرتبطة"}
              </Row>
              <div>
                <h4 className="font-bold text-sm mb-2">نتائج التحقق قبل النشر</h4>
                <ul className="space-y-1 text-xs">
                  {issuesFor(selected).map((i, idx) => (
                    <li key={idx} className={i.severity === "error" ? "text-destructive" : "text-amber-600"}>
                      • {i.message}
                    </li>
                  ))}
                  {issuesFor(selected).length === 0 && <li className="text-green-600">• لا توجد ملاحظات</li>}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-sm mb-2">دورة الاعتماد</h4>
                <div className="space-y-2">
                  {APPROVAL_STAGES.map((s) => {
                    const rec = (data?.approvals ?? []).find(
                      (a) => (a as Record<string, unknown>)["rule_id"] === selected.id && (a as Record<string, unknown>)["stage"] === s.stage,
                    ) as Record<string, unknown> | undefined;
                    const status = String(rec?.["status"] ?? "pending");
                    return (
                      <div key={s.stage} className="flex items-center justify-between border rounded-md p-2">
                        <span className="text-xs">{s.order}. {s.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={status === "approved" ? "default" : "outline"}>{status}</Badge>
                          {status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const { error } = await supabase.from("rule_approvals").upsert(
                                  {
                                    rule_id: selected.id,
                                    stage: s.stage,
                                    stage_order: s.order,
                                    status: "approved",
                                    decided_at: new Date().toISOString(),
                                  },
                                  { onConflict: "rule_id,stage" },
                                );
                                if (error) return toast.error(error.message);
                                toast.success("تم الاعتماد");
                                invalidate();
                              }}
                            >
                              اعتماد
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>إغلاق</Button>
            {selected && selected.status !== "published" && (
              <Button onClick={() => { void publish(selected); setSelected(null); }}>نشر</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create rule */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة قاعدة قانونية</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="رمز القاعدة"><Input value={ruleForm.rule_code} onChange={(e) => setRuleForm({ ...ruleForm, rule_code: e.target.value })} /></Field>
            <Field label="اسم القاعدة"><Input value={ruleForm.rule_name} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} /></Field>
            <Field label="نوع القاعدة">
              <Select value={ruleForm.rule_type} onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v as RuleType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="نوع المطالبة"><Input value={ruleForm.claim_type} onChange={(e) => setRuleForm({ ...ruleForm, claim_type: e.target.value })} /></Field>
            <Field label="النظام">
              <Select value={ruleForm.system_id} onValueChange={(v) => setRuleForm({ ...ruleForm, system_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر النظام" /></SelectTrigger>
                <SelectContent>
                  {(data?.systems ?? []).filter((s) => s.country_code === country).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="المادة القانونية">
              <Select value={ruleForm.article_id} onValueChange={(v) => setRuleForm({ ...ruleForm, article_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>
                  {(data?.articles ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>المادة {a.article_number} — {a.article_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="المعادلة">
              <Select value={ruleForm.formula_id} onValueChange={(v) => setRuleForm({ ...ruleForm, formula_id: v })}>
                <SelectTrigger><SelectValue placeholder="بدون معادلة" /></SelectTrigger>
                <SelectContent>
                  {(data?.formulas ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.formula_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="القطاع"><Input value={ruleForm.sector} onChange={(e) => setRuleForm({ ...ruleForm, sector: e.target.value })} /></Field>
            <Field label="نوع العامل"><Input value={ruleForm.worker_type} onChange={(e) => setRuleForm({ ...ruleForm, worker_type: e.target.value })} /></Field>
            <Field label="نوع العقد"><Input value={ruleForm.contract_type} onChange={(e) => setRuleForm({ ...ruleForm, contract_type: e.target.value })} /></Field>
            <Field label="الأولوية"><Input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })} /></Field>
            <Field label="درجة التخصص"><Input type="number" value={ruleForm.specificity} onChange={(e) => setRuleForm({ ...ruleForm, specificity: Number(e.target.value) })} /></Field>
            <Field label="الإصدار"><Input value={ruleForm.version} onChange={(e) => setRuleForm({ ...ruleForm, version: e.target.value })} /></Field>
            <Field label="تاريخ السريان"><Input type="date" value={ruleForm.effective_date} onChange={(e) => setRuleForm({ ...ruleForm, effective_date: e.target.value })} /></Field>
            <Field label="تاريخ الانتهاء"><Input type="date" value={ruleForm.expiry_date} onChange={(e) => setRuleForm({ ...ruleForm, expiry_date: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="القيم (JSON)">
                <Textarea dir="ltr" rows={4} value={ruleForm.value} onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="الوصف">
                <Textarea rows={2} value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>إلغاء</Button>
            <Button onClick={saveRule}>حفظ كمسودة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-1 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium text-left">{children}</span>
    </div>
  );
}

function EditableCell({
  table,
  idField,
  id,
  field,
  value,
  onSaved,
}: {
  table: "countries";
  idField: string;
  id: string;
  field: string;
  value: string | null;
  onSaved: () => void;
}) {
  const [val, setVal] = useState(value ?? "");
  return (
    <Input
      className="h-8 text-xs"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={async () => {
        if (val === (value ?? "")) return;
        const { error } = await supabase.from(table).update({ [field]: val || null } as never).eq(idField, id);
        if (error) return toast.error(error.message);
        toast.success("تم الحفظ");
        onSaved();
      }}
    />
  );
}

function bumpVersion(v: string) {
  const parts = v.split(".");
  const last = Number(parts[parts.length - 1] ?? 0);
  parts[parts.length - 1] = String(Number.isFinite(last) ? last + 1 : 1);
  return parts.join(".");
}
