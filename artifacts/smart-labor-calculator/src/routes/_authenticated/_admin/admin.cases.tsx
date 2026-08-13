import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Search, Download, Archive, RotateCcw, Trash2, Merge, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/cases")({
  component: AdminCasesPage,
});

type Filters = {
  q: string;
  status: string;
  branch: string;
  from: string;
  to: string;
};

const STATUSES = [
  { value: "all", label: "كل الحالات" },
  { value: "open", label: "مفتوحة" },
  { value: "closed", label: "مغلقة" },
  { value: "archived", label: "مؤرشفة" },
];

function AdminCasesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ q: "", status: "all", branch: "all", from: "", to: "" });
  const [selected, setSelected] = useState<string[]>([]);

  const { data: branches } = useQuery({
    queryKey: ["admin", "branches-lite"],
    queryFn: async () => (await supabase.from("branches").select("id, name").order("name")).data ?? [],
  });

  const { data: lawyers } = useQuery({
    queryKey: ["admin", "lawyers-lite"],
    queryFn: async () =>
      (await supabase.from("lawyers").select("id, full_name").order("full_name").limit(200)).data ?? [],
  });

  const { data: cases, isLoading } = useQuery({
    queryKey: ["admin", "cases", filters],
    queryFn: async () => {
      let query = supabase
        .from("sa_cases")
        .select(
          "id, employee_name, employer_name, national_id, nationality, job_title, status, archived, contract_type, branch_id, assigned_lawyer_id, total_amount, currency, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (filters.status !== "all") {
        if (filters.status === "archived") query = query.eq("archived", true);
        else query = query.eq("status", filters.status).eq("archived", false);
      }
      if (filters.branch !== "all") query = query.eq("branch_id", filters.branch);
      if (filters.from) query = query.gte("created_at", filters.from);
      if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);
      if (filters.q.trim()) {
        const q = filters.q.trim();
        query = query.or(
          `employee_name.ilike.%${q}%,employer_name.ilike.%${q}%,national_id.ilike.%${q}%,job_title.ilike.%${q}%`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const rows = cases ?? [];
    return { count: rows.length, amount: rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) };
  }, [cases]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "cases"] });

  type CasePatch = {
    status?: string;
    archived?: boolean;
    branch_id?: string | null;
    assigned_lawyer_id?: string | null;
    merged_into?: string | null;
  };

  const patchCase = async (ids: string[], patch: CasePatch, msg: string) => {
    const { error } = await supabase.from("sa_cases").update(patch).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(msg);
    setSelected([]);
    refresh();
  };

  const removeCases = async (ids: string[]) => {
    if (!confirm(`حذف ${ids.length} قضية نهائياً؟`)) return;
    const { error } = await supabase.from("sa_cases").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    setSelected([]);
    refresh();
  };

  const mergeCases = async () => {
    if (selected.length !== 2) return toast.error("اختر قضيتين للدمج");
    const [target, source] = selected;
    const { error } = await supabase
      .from("sa_cases")
      .update({ merged_into: target, status: "closed", archived: true })
      .eq("id", source);
    if (error) return toast.error(error.message);
    toast.success("تم دمج القضيتين");
    setSelected([]);
    refresh();
  };

  const exportCsv = () => {
    const rows = cases ?? [];
    const header = ["رقم القضية", "العامل", "صاحب العمل", "رقم الهوية", "الحالة", "نوع العقد", "المبلغ", "العملة", "التاريخ"];
    const body = rows.map((r) =>
      [
        r.id,
        r.employee_name ?? "",
        r.employer_name ?? "",
        r.national_id ?? "",
        r.archived ? "مؤرشفة" : (r.status ?? "open"),
        r.contract_type ?? "",
        r.total_amount ?? 0,
        r.currency ?? "",
        new Date(r.created_at).toLocaleDateString("ar-SA"),
      ].join(","),
    );
    const csv = `\uFEFF${[header.join(","), ...body].join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cases-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      permission="cases.manage"
      title="إدارة القضايا"
      description="بحث متقدم وإجراءات إدارية: أرشفة، إعادة فتح، دمج، نقل بين الفروع، تعيين محامٍ، تصدير"
      icon={Briefcase}
      actions={
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 ml-1" /> تصدير CSV
        </Button>
      }
    >
      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">بحث (العامل، صاحب العمل، الهوية، الوظيفة)</Label>
            <div className="relative">
              <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pr-8"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="ابحث..."
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">الحالة</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">الفرع</Label>
            <Select value={filters.branch} onValueChange={(v) => setFilters({ ...filters, branch: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <Badge variant="outline">النتائج: {totals.count}</Badge>
        <Badge variant="outline">إجمالي المطالبات: {totals.amount.toLocaleString("ar-SA")}</Badge>
        {selected.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => patchCase(selected, { archived: true, status: "archived" }, "تمت الأرشفة")}>
              <Archive className="h-4 w-4 ml-1" /> أرشفة
            </Button>
            <Button size="sm" variant="outline" onClick={() => patchCase(selected, { archived: false, status: "open" }, "تمت إعادة الفتح")}>
              <RotateCcw className="h-4 w-4 ml-1" /> إعادة فتح
            </Button>
            <Button size="sm" variant="outline" onClick={mergeCases}>
              <Merge className="h-4 w-4 ml-1" /> دمج قضيتين
            </Button>
            <Button size="sm" variant="destructive" onClick={() => removeCases(selected)}>
              <Trash2 className="h-4 w-4 ml-1" /> حذف
            </Button>
          </>
        )}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="p-2"></th>
              <th className="p-2 text-right">العامل</th>
              <th className="p-2 text-right">صاحب العمل</th>
              <th className="p-2 text-right">الهوية</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2 text-right">المبلغ</th>
              <th className="p-2 text-right">الفرع</th>
              <th className="p-2 text-right">المحامي</th>
              <th className="p-2 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
            )}
            {!isLoading && (cases ?? []).length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد نتائج</td></tr>
            )}
            {(cases ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                    }
                  />
                </td>
                <td className="p-2">{c.employee_name || "—"}</td>
                <td className="p-2">{c.employer_name || "—"}</td>
                <td className="p-2">{c.national_id || "—"}</td>
                <td className="p-2">
                  <Badge variant={c.archived ? "secondary" : "outline"}>
                    {c.archived ? "مؤرشفة" : (c.status ?? "open")}
                  </Badge>
                </td>
                <td className="p-2">
                  {Number(c.total_amount ?? 0).toLocaleString("ar-SA")} {c.currency ?? ""}
                </td>
                <td className="p-2">
                  <Select
                    value={c.branch_id ?? "none"}
                    onValueChange={(v) => patchCase([c.id], { branch_id: v === "none" ? null : v }, "تم نقل القضية")}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون فرع</SelectItem>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select
                    value={c.assigned_lawyer_id ?? "none"}
                    onValueChange={(v) =>
                      patchCase([c.id], { assigned_lawyer_id: v === "none" ? null : v }, "تم تعيين المحامي")
                    }
                  >
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">غير معيّن</SelectItem>
                      {(lawyers ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("ar-SA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
        <Users className="h-3 w-3" /> اختر قضيتين ثم اضغط «دمج قضيتين» لدمج الثانية في الأولى.
      </p>
    </AdminShell>
  );
}
