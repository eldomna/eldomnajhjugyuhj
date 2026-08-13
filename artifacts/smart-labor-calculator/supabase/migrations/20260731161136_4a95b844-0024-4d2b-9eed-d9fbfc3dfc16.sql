CREATE TABLE public.case_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  claim_requested text NOT NULL DEFAULT 'yes',
  compensation_type text,
  compensation_label text,
  legal_basis text,
  legal_reference text,
  contract_type text,
  termination_reason text,
  notice_status text NOT NULL DEFAULT 'no',
  notice_required boolean NOT NULL DEFAULT false,
  notice_period_days integer,
  notice_actual_days integer,
  notice_shortfall_days integer,
  notice_compensation numeric NOT NULL DEFAULT 0,
  approved_wage numeric NOT NULL DEFAULT 0,
  service_years numeric NOT NULL DEFAULT 0,
  remaining_contract_months numeric,
  base_compensation numeric NOT NULL DEFAULT 0,
  final_compensation numeric NOT NULL DEFAULT 0,
  has_agreement_clause boolean NOT NULL DEFAULT false,
  agreement_amount numeric,
  agreement_method text,
  agreement_conflicts_law boolean NOT NULL DEFAULT false,
  payment_status text NOT NULL DEFAULT 'not_paid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_method text,
  proof_file text,
  court_judgment_reference text,
  excluded_from_claim boolean NOT NULL DEFAULT false,
  legal_rule_version text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX case_compensation_case_idx ON public.case_compensation(case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_compensation TO authenticated;
GRANT ALL ON public.case_compensation TO service_role;

ALTER TABLE public.case_compensation ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_compensation_own ON public.case_compensation
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.case_drafts d WHERE d.id = case_compensation.case_id AND d.user_id = auth.uid())
  );

CREATE TRIGGER case_compensation_touch
  BEFORE UPDATE ON public.case_compensation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.sa_regulatory_settings (key, label, category, description, value)
VALUES (
  'compensation',
  'قواعد التعويضات وبدل الإشعار (المحرك القانوني)',
  'compensation',
  'قواعد احتساب التعويضات وبدل الإشعار (PART 1L)',
  jsonb_build_object(
    'version', 'SA-COMP-2024-1',
    'effective_from', '2015-01-01',
    'legal_basis', 'نظام العمل السعودي — المواد 74، 75، 77، 80، 81، 84',
    'wage_rule', 'last_wage',
    'types', jsonb_build_array(
      jsonb_build_object('code','unlawful_termination','label','تعويض الإنهاء غير المشروع','formula','article_77','legal_ref','المادة 77'),
      jsonb_build_object('code','article_77','label','تعويض المادة 77','formula','article_77','legal_ref','المادة 77'),
      jsonb_build_object('code','notice_allowance','label','بدل الإشعار','formula','notice','legal_ref','المادتان 75 و76'),
      jsonb_build_object('code','fixed_term_remaining','label','تعويض إنهاء العقد المحدد المدة','formula','remaining_term','legal_ref','المادة 77/1'),
      jsonb_build_object('code','indefinite_term','label','تعويض إنهاء العقد غير المحدد المدة','formula','article_77_indefinite','legal_ref','المادة 77/2'),
      jsonb_build_object('code','mutual_agreement','label','تعويض الاتفاق بين الطرفين','formula','agreement','legal_ref','المادة 74/1'),
      jsonb_build_object('code','trial_period','label','تعويض الإنهاء أثناء فترة التجربة','formula','none','legal_ref','المادة 53'),
      jsonb_build_object('code','protected_leave','label','تعويض الفصل بسبب الحمل أو الإجازات المحمية','formula','article_77','legal_ref','المادتان 155 و156'),
      jsonb_build_object('code','contract_clause','label','تعويض خاص بموجب عقد العمل','formula','agreement','legal_ref','بند تعاقدي'),
      jsonb_build_object('code','court_judgment','label','تعويض بحكم قضائي','formula','court','legal_ref','حكم قضائي'),
      jsonb_build_object('code','other','label','تعويض آخر','formula','manual','legal_ref','—')
    ),
    'legal_bases', jsonb_build_array(
      jsonb_build_object('code','statute','label','نص قانوني محدد'),
      jsonb_build_object('code','contract_clause','label','بند في عقد العمل'),
      jsonb_build_object('code','collective_agreement','label','اتفاقية جماعية'),
      jsonb_build_object('code','court_judgment','label','حكم قضائي'),
      jsonb_build_object('code','internal_regulation','label','لائحة داخلية'),
      jsonb_build_object('code','other','label','سبب آخر')
    ),
    'notice_rules', jsonb_build_object(
      'indefinite_days', 30,
      'indefinite_days_monthly_wage', 60,
      'fixed_days', 30,
      'part_time_days', 30,
      'seasonal_days', 15,
      'trial_days', 0,
      'legal_ref', 'المادتان 75 و76'
    ),
    'article_77', jsonb_build_object(
      'indefinite_per_year_wages', 15,
      'indefinite_min_wages', 2,
      'fixed_remaining_months', true,
      'fixed_min_wages', 2,
      'allow_better_contract_clause', true,
      'legal_ref', 'المادة 77'
    ),
    'overlap_rules', jsonb_build_array(
      jsonb_build_object('group','termination_compensation','codes', jsonb_build_array('unlawful_termination','article_77','fixed_term_remaining','indefinite_term'),'mode','exclusive','priority', jsonb_build_array('court_judgment','article_77','fixed_term_remaining','indefinite_term','unlawful_termination'),'note','لا يجوز الجمع بين أكثر من تعويض عن ذات واقعة الإنهاء، ويُطبق الأعلى وفق أولوية النصوص.'),
      jsonb_build_object('group','notice','codes', jsonb_build_array('notice_allowance'),'mode','combinable','note','يجوز الجمع بين بدل الإشعار وتعويض الإنهاء.')
    ),
    'payment_methods', jsonb_build_array(
      jsonb_build_object('code','bank_transfer','label','تحويل بنكي'),
      jsonb_build_object('code','cheque','label','شيك'),
      jsonb_build_object('code','cash','label','نقداً'),
      jsonb_build_object('code','settlement','label','مخالصة'),
      jsonb_build_object('code','receipt_voucher','label','سند قبض'),
      jsonb_build_object('code','other','label','مستند آخر')
    ),
    'notes', 'التحليل استرشادي مبني على القواعد المحمّلة من محرك القوانين ولا يُعد حكماً قضائياً.'
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;