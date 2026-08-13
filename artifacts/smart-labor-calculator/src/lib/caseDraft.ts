import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CaseInfo = {
  employeeName: string;
  nationality: string;
  idNumber: string;
  employerName: string;
  jobTitle: string;
  city: string;
};

export const emptyCaseInfo: CaseInfo = {
  employeeName: "",
  nationality: "",
  idNumber: "",
  employerName: "",
  jobTitle: "",
  city: "",
};

export type FieldErrors = Partial<Record<keyof CaseInfo, string>>;

const AR_EN_NAME = /^[\u0600-\u06FFa-zA-Z\s'.-]{3,80}$/;

export function validateCaseInfo(v: CaseInfo, country: string): FieldErrors {
  const e: FieldErrors = {};
  if (!v.employeeName.trim()) e.employeeName = "اسم العامل مطلوب";
  else if (!AR_EN_NAME.test(v.employeeName.trim())) e.employeeName = "الاسم يجب أن يكون حروفاً فقط (3 أحرف على الأقل)";

  if (!v.nationality.trim()) e.nationality = "الجنسية مطلوبة";

  const id = v.idNumber.replace(/\s/g, "");
  if (!id) e.idNumber = "رقم الهوية / الإقامة مطلوب";
  else if (!/^\d+$/.test(id)) e.idNumber = "رقم الهوية يجب أن يكون أرقاماً فقط";
  else if (country === "SA" && id.length !== 10) e.idNumber = "رقم الهوية / الإقامة في السعودية يكون 10 أرقام";
  else if (id.length < 6 || id.length > 20) e.idNumber = "رقم غير صحيح";

  if (!v.employerName.trim()) e.employerName = "جهة العمل مطلوبة";
  else if (v.employerName.trim().length < 2) e.employerName = "اسم جهة العمل قصير جداً";

  if (!v.jobTitle.trim()) e.jobTitle = "المسمى الوظيفي مطلوب";
  if (!v.city.trim()) e.city = "المدينة مطلوبة";

  return e;
}

type DraftRow = { id: string; data: Record<string, unknown>; current_step: number };

/**
 * مسودة القضية: تحميل + حفظ تلقائي + تراجع/إعادة.
 * لا تمس محركات الحساب — تحفظ المدخلات فقط.
 */
export function useCaseDraft(country: string, step = 1) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [info, setInfo] = useState<CaseInfo>(emptyCaseInfo);

  const past = useRef<CaseInfo[]>([]);
  const future = useRef<CaseInfo[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("case_drafts")
        .select("id,data,current_step")
        .eq("country_code", country)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<DraftRow>();
      if (error) throw error;
      if (data) {
        setDraftId(data.id);
        const saved = (data.data?.case_info ?? {}) as Partial<CaseInfo>;
        setInfo({ ...emptyCaseInfo, ...saved });
      }
      hydrated.current = true;
    } catch (err: any) {
      setLoadError(err?.message ?? "تعذّر تحميل المسودة");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (value: CaseInfo, extra?: Record<string, unknown>) => {
      setSaving(true);
      try {
        const { data, error } = await supabase.rpc("upsert_case_draft", {
          _country_code: country,
          _step: step,
          _data: { case_info: value, ...(extra ?? {}) } as never,
        });
        if (error) throw error;
        if (typeof data === "string") setDraftId(data);
        setSavedAt(new Date());
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [country, step],
  );


  /** تعديل حقل مع تسجيله في سجل التراجع وجدولة الحفظ التلقائي */
  const update = useCallback(
    (patch: Partial<CaseInfo>) => {
      setInfo((prev) => {
        const next = { ...prev, ...patch };
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        setHistoryTick((t) => t + 1);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void persist(next), 1200);
        return next;
      });
    },
    [persist],
  );

  const undo = useCallback(() => {
    if (!past.current.length) return;
    setInfo((cur) => {
      const prev = past.current[past.current.length - 1];
      past.current = past.current.slice(0, -1);
      future.current = [cur, ...future.current].slice(0, 50);
      setHistoryTick((t) => t + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(prev), 800);
      return prev;
    });
  }, [persist]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    setInfo((cur) => {
      const next = future.current[0];
      future.current = future.current.slice(1);
      past.current = [...past.current, cur].slice(-50);
      setHistoryTick((t) => t + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(next), 800);
      return next;
    });
  }, [persist]);

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return persist(info);
  }, [persist, info]);

  /** حفظ فوري مع بيانات إضافية (نتائج خطوات المعالج) */
  const saveNowWith = useCallback(
    async (extra: Record<string, unknown>) => {
      if (timer.current) clearTimeout(timer.current);
      return persist(info, extra);
    },
    [persist, info],
  );


  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return {
    info,
    update,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    historyTick,
    loading,
    loadError,
    reload: load,
    saving,
    savedAt,
    saveNow,
    saveNowWith,

    draftId,
  };
}
