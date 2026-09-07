import { supabase } from "@/integrations/supabase/client";
import { setStoredCountry } from "@/lib/countries";

/**
 * يحدد الوجهة الصحيحة بعد أي تسجيل دخول ناجح (إيميل/باسورد أو OAuth):
 * - لو اليوزر عنده دولة محفوظة مسبقاً في profiles.country وهي دولة مفعّلة،
 *   يرجع مسار حاسبته مباشرة (ويخزّن الدولة محلياً عشان بقية الواجهة).
 * - غير كده (حساب جديد / لا يوجد قيمة / الدولة معطّلة حالياً) يرجع "/select-country".
 *
 * المصدر الوحيد للحقيقة هو قاعدة البيانات — الـ localStorage تابع بس، مش مرجع.
 */
export async function resolvePostLoginDestination(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "/select-country";

    const { data: profile } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.country) return "/select-country";

    const { data: countryRow } = await supabase
      .from("countries")
      .select("calculator_path")
      .eq("code", profile.country)
      .eq("is_active", true)
      .maybeSingle();

    if (!countryRow?.calculator_path) return "/select-country";

    setStoredCountry(profile.country);
    return countryRow.calculator_path;
  } catch {
    // أي خطأ هنا لا يمنع الدخول — يرجع لشاشة اختيار الدولة العادية
    return "/select-country";
  }
}
