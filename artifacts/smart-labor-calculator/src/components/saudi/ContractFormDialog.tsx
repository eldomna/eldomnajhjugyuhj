import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  END_REASONS,
  emptyContract,
  validateContract,
  type Contract,
  type ContractDraft,
  type ContractErrors,
} from "@/lib/saudi/contracts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContractDraft | null;
  editingId?: string;
  others: Contract[];
  saving?: boolean;
  onSubmit: (value: ContractDraft) => Promise<boolean>;
};

export function ContractFormDialog({
  open,
  onOpenChange,
  initial,
  editingId,
  others,
  saving,
  onSubmit,
}: Props) {
  const [v, setV] = useState<ContractDraft>(initial ?? emptyContract);
  const [errors, setErrors] = useState<ContractErrors>({});

  useEffect(() => {
    if (open) {
      setV(initial ?? emptyContract);
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof ContractDraft>(k: K, val: ContractDraft[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const setRenewCount = (n: number) => {
    const count = Math.max(0, Math.min(50, n || 0));
    setV((s) => {
      const hist = [...s.renew_history];
      while (hist.length < count) hist.push({ date: "", months: 12 });
      return { ...s, renew_count: count, renew_history: hist.slice(0, count) };
    });
  };

  const submit = async () => {
    const e = validateContract(v, others, editingId);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const ok = await onSubmit(v);
    if (ok) onOpenChange(false);
  };

  const Err = ({ k }: { k: keyof ContractDraft }) =>
    errors[k] ? <p className="text-[11px] font-medium text-destructive">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "تعديل العقد" : "إضافة عقد جديد"}</DialogTitle>
        </DialogHeader>

        {errors._form && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errors._form}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">رقم العقد <span className="text-destructive">*</span></Label>
            <Input value={v.contract_number} onChange={(e) => set("contract_number", e.target.value)} />
            <Err k="contract_number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">اسم العقد (اختياري)</Label>
            <Input value={v.contract_name ?? ""} onChange={(e) => set("contract_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ بداية العقد <span className="text-destructive">*</span></Label>
            <Input type="date" dir="ltr" value={v.start_date} onChange={(e) => set("start_date", e.target.value)} />
            <Err k="start_date" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ نهاية العقد</Label>
            <Input
              type="date"
              dir="ltr"
              value={v.end_date ?? ""}
              onChange={(e) => set("end_date", e.target.value || null)}
            />
            <Err k="end_date" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ مباشرة العمل</Label>
            <Input
              type="date"
              dir="ltr"
              value={v.joining_date ?? ""}
              onChange={(e) => set("joining_date", e.target.value || null)}
            />
            <Err k="joining_date" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">نوع العقد</Label>
            <RadioGroup
              className="flex gap-4 pt-2"
              value={v.contract_type}
              onValueChange={(val) => set("contract_type", val as ContractDraft["contract_type"])}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="fixed_term" /> محدد المدة
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="indefinite" /> غير محدد المدة
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={v.is_qiwa_documented}
              onCheckedChange={(c) => set("is_qiwa_documented", c)}
            />
            <span className="text-sm">العقد موثق في منصة قوى</span>
          </div>
          {v.is_qiwa_documented && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">رقم عقد قوى (اختياري)</Label>
              <Input
                dir="ltr"
                value={v.qiwa_contract_number ?? ""}
                onChange={(e) => set("qiwa_contract_number", e.target.value || null)}
              />
            </div>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={v.renewed}
              onCheckedChange={(c) =>
                setV((s) => ({
                  ...s,
                  renewed: c,
                  renew_count: c ? Math.max(1, s.renew_count) : 0,
                  renew_history: c ? (s.renew_history.length ? s.renew_history : [{ date: "", months: 12 }]) : [],
                }))
              }
            />
            <span className="text-sm">تم تجديد العقد</span>
          </div>

          {v.renewed && (
            <div className="space-y-3 rounded-lg border p-3 sm:col-span-2">
              <div className="space-y-1.5">
                <Label className="text-xs">عدد مرات التجديد</Label>
                <Input
                  type="number"
                  dir="ltr"
                  min={1}
                  value={v.renew_count}
                  onChange={(e) => setRenewCount(Number(e.target.value))}
                />
                <Err k="renew_count" />
              </div>
              {v.renew_history.map((r, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">تاريخ التجديد {i + 1}</Label>
                    <Input
                      type="date"
                      dir="ltr"
                      value={r.date}
                      onChange={(e) =>
                        setV((s) => {
                          const hist = [...s.renew_history];
                          hist[i] = { ...hist[i], date: e.target.value };
                          return { ...s, renew_history: hist };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">مدة التجديد {i + 1} (أشهر)</Label>
                    <Input
                      type="number"
                      dir="ltr"
                      min={1}
                      value={r.months}
                      onChange={(e) =>
                        setV((s) => {
                          const hist = [...s.renew_history];
                          hist[i] = { ...hist[i], months: Number(e.target.value) || 0 };
                          return { ...s, renew_history: hist };
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setRenewCount(v.renew_count + 1)}>
                  <Plus className="h-3.5 w-3.5" /> تجديد إضافي
                </Button>
                {v.renew_count > 1 && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setRenewCount(v.renew_count - 1)}>
                    <Trash2 className="h-3.5 w-3.5" /> حذف الأخير
                  </Button>
                )}
              </div>
              {errors.renew_history && (
                <p className="text-[11px] font-medium text-destructive">{errors.renew_history}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={v.ended} onCheckedChange={(c) => set("ended", c)} />
            <span className="text-sm">هذا العقد منتهٍ</span>
          </div>

          {v.ended && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">سبب انتهاء العقد</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={v.end_reason ?? ""}
                  onChange={(e) => set("end_reason", e.target.value || null)}
                >
                  <option value="">— اختر —</option>
                  {END_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <Err k="end_reason" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ انتهاء العقد</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={v.actual_end_date ?? ""}
                  onChange={(e) => set("actual_end_date", e.target.value || null)}
                />
                <Err k="actual_end_date" />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="gap-2" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ العقد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
