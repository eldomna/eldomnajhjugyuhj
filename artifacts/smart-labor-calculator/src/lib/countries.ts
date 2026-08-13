import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Country = {
  code: string;
  name_ar: string;
  name_en: string;
  flag: string;
  currency: string;
  engine: string;
  calculator_path: string;
  description_ar: string | null;
  description_en: string | null;
  sort_order: number;
};

const STORAGE_KEY = "slc.country";

export function getStoredCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredCountry(code: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

/** الدول المفعّلة — تُدار بالكامل من لوحة التحكم بدون تعديل الكود */
export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: async (): Promise<Country[]> => {
      const { data, error } = await supabase
        .from("countries")
        .select(
          "code,name_ar,name_en,flag,currency,engine,calculator_path,description_ar,description_en,sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Country[];
    },
    staleTime: 5 * 60_000,
  });
}

/** الدولة المختارة في الجلسة الحالية (تُحفظ محلياً حتى يغيّرها المستخدم) */
export function useSelectedCountry() {
  const [code, setCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCode(getStoredCountry());
    setReady(true);
  }, []);

  const select = useCallback((next: string) => {
    setStoredCountry(next);
    setCode(next);
  }, []);

  return { code, ready, select };
}
