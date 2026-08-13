-- 1) جدول الدول (يُدار من لوحة التحكم بدون تعديل الكود)
CREATE TABLE IF NOT EXISTS public.countries (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  flag text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'SAR',
  engine text NOT NULL DEFAULT 'sa',
  calculator_path text NOT NULL DEFAULT '/calculator',
  description_ar text,
  description_en text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.countries TO anon;
GRANT SELECT ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "countries_public_read" ON public.countries;
CREATE POLICY "countries_public_read" ON public.countries
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "countries_admin_all" ON public.countries;
CREATE POLICY "countries_admin_all" ON public.countries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS countries_touch ON public.countries;
CREATE TRIGGER countries_touch BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.countries (code, name_ar, name_en, flag, currency, engine, calculator_path, description_ar, description_en, sort_order)
VALUES
  ('SA','المملكة العربية السعودية','Saudi Arabia','🇸🇦','SAR','sa','/sa/calculator',
   'محرك ديناميكي وفق نظام العمل السعودي ولائحته التنفيذية: مكافأة نهاية الخدمة، الساعات الإضافية، الإجازات، التأمينات الاجتماعية، والمتأخرات.',
   'Dynamic engine based on the Saudi Labor Law: end-of-service, overtime, leave, GOSI and unpaid wages.', 1),
  ('YE','الجمهورية اليمنية','Yemen','🇾🇪','YER','ye','/calculator',
   'المحرك اليمني المعتمد وفق قانون العمل رقم 5 لسنة 1995 — يعمل دون أي تعديل على معادلاته.',
   'Yemeni engine based on Labor Law No. 5 of 1995 — formulas unchanged.', 2)
ON CONFLICT (code) DO NOTHING;

-- 2) مسودات القضايا (Session للحساب + حفظ تلقائي + استكمال لاحقاً)
CREATE TABLE IF NOT EXISTS public.case_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text NOT NULL DEFAULT 'SA' REFERENCES public.countries(code),
  status text NOT NULL DEFAULT 'draft',
  current_step integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_drafts_user_idx ON public.case_drafts (user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS case_drafts_one_open_per_country
  ON public.case_drafts (user_id, country_code) WHERE status = 'draft';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_drafts TO authenticated;
GRANT ALL ON public.case_drafts TO service_role;

ALTER TABLE public.case_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_drafts_own" ON public.case_drafts;
CREATE POLICY "case_drafts_own" ON public.case_drafts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS case_drafts_touch ON public.case_drafts;
CREATE TRIGGER case_drafts_touch BEFORE UPDATE ON public.case_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) حفظ/تحديث مسودة القضية بدون تكرار السجل
CREATE OR REPLACE FUNCTION public.upsert_case_draft(
  _country_code text,
  _step integer,
  _data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT id INTO v_id FROM public.case_drafts
   WHERE user_id = v_uid AND country_code = upper(_country_code) AND status = 'draft'
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.case_drafts (user_id, country_code, current_step, data)
    VALUES (v_uid, upper(_country_code), GREATEST(COALESCE(_step,1),1), COALESCE(_data,'{}'::jsonb))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.case_drafts
       SET data = COALESCE(public.case_drafts.data,'{}'::jsonb) || COALESCE(_data,'{}'::jsonb),
           current_step = GREATEST(current_step, COALESCE(_step,1))
     WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_case_draft(text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_case_draft(text, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_case_draft(text, integer, jsonb) TO authenticated;