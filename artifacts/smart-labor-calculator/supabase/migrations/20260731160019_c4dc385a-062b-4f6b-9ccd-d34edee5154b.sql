CREATE TABLE public.case_eosb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  eligible boolean NOT NULL DEFAULT true,
  ineligibility_reason text,
  service_start_date date,
  service_end_date date,
  total_service_years integer NOT NULL DEFAULT 0,
  total_service_months integer NOT NULL DEFAULT 0,
  total_service_days integer NOT NULL DEFAULT 0,
  service_fraction_years numeric NOT NULL DEFAULT 0,
  last_approved_wage numeric NOT NULL DEFAULT 0,
  wage_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_type text,
  termination_reason text,
  base_gratuity_amount numeric NOT NULL DEFAULT 0,
  eligibility_percentage numeric NOT NULL DEFAULT 0,
  final_gratuity_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'not_paid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_method text,
  proof_file text,
  has_settlement boolean NOT NULL DEFAULT false,
  has_court_ruling boolean NOT NULL DEFAULT false,
  has_better_agreement boolean NOT NULL DEFAULT false,
  agreement_amount numeric,
  exceptions_notes text,
  legal_rule_version text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_eosb_unique UNIQUE (case_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_eosb TO authenticated;
GRANT ALL ON public.case_eosb TO service_role;
ALTER TABLE public.case_eosb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_eosb_own" ON public.case_eosb FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.case_drafts d WHERE d.id = case_eosb.case_id AND d.user_id = auth.uid()
));

CREATE TRIGGER case_eosb_touch BEFORE UPDATE ON public.case_eosb
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER case_eosb_audit AFTER INSERT OR UPDATE OR DELETE ON public.case_eosb
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

INSERT INTO public.sa_regulatory_settings (key, category, label, description, value)
VALUES ('eosb_gratuity', 'eosb', 'قواعد مكافأة نهاية الخدمة (المحرك القانوني)',
 'قواعد احتساب مكافأة نهاية الخدمة: الأجر المعتمد، كسور السنة، أثر سبب الإنهاء، الاستثناءات وطرق السداد.',
 jsonb_build_object(
  'version', 'SA-EOSB-2026.1',
  'effective_from', '2015-01-01',
  'legal_basis', 'نظام العمل السعودي — المواد 84 إلى 88',
  'wage_rule', 'last_wage',
  'wage_included', jsonb_build_array('basic_salary','housing_allowance','transport_allowance','communication_allowance','work_nature_allowance','risk_allowance','delegation_allowance','other_allowances','fixed_commission','fixed_bonus','other_benefits'),
  'wage_excluded', jsonb_build_array('العمولات المتغيرة','الأجر الإضافي','المكافآت السنوية غير الثابتة','المزايا العينية'),
  'first_years', 5,
  'first_rate', 0.5,
  'after_rate', 1.0,
  'fraction_rule', 'prorata',
  'merge_continuous_contracts', true,
  'entity_transfer_counts', true,
  'allow_better_agreement', true,
  'reason_effects', jsonb_build_array(
    jsonb_build_object('match', jsonb_build_array('contract_expiry','employer_termination','mutual_agreement','article_77','article_80_employee','force_majeure','retirement','establishment_closure'), 'rate', 1, 'label', 'استحقاق كامل', 'legal_ref', 'المادة 84'),
    jsonb_build_object('match', jsonb_build_array('resignation'), 'scale', jsonb_build_array(
      jsonb_build_object('from', 0, 'to', 2, 'rate', 0),
      jsonb_build_object('from', 2, 'to', 5, 'rate', 0.3333),
      jsonb_build_object('from', 5, 'to', 10, 'rate', 0.6667),
      jsonb_build_object('from', 10, 'to', null, 'rate', 1)
    ), 'label', 'نسب الاستقالة', 'legal_ref', 'المادة 85'),
    jsonb_build_object('match', jsonb_build_array('death','disability','female_marriage','female_childbirth','article_81'), 'rate', 1, 'label', 'استحقاق كامل للحالات الخاصة', 'legal_ref', 'المواد 85 و87'),
    jsonb_build_object('match', jsonb_build_array('article_80','article_80_dismissal','trial_period_termination'), 'rate', 0, 'label', 'لا استحقاق وفق القاعدة المطبقة', 'legal_ref', 'المادتان 80 و53')
  ),
  'exclusions', jsonb_build_array('trial_period_termination'),
  'beneficiary_notes', jsonb_build_object('death', 'تُصرف المكافأة للورثة الشرعيين', 'disability', 'تُصرف كاملة عند العجز المؤثر على الاستمرار في العمل'),
  'payment_methods', jsonb_build_array(
    jsonb_build_object('code','bank_transfer','label','تحويل بنكي'),
    jsonb_build_object('code','cheque','label','شيك'),
    jsonb_build_object('code','cash','label','نقداً'),
    jsonb_build_object('code','receipt_voucher','label','سند قبض'),
    jsonb_build_object('code','final_settlement','label','مخالصة نهائية'),
    jsonb_build_object('code','other','label','مستند آخر')
  ),
  'notes', 'القواعد قابلة للتعديل من لوحة التحكم دون تعديل الكود.'
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;