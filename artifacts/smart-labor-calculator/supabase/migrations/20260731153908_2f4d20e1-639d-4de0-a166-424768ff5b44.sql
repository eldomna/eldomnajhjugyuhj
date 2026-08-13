CREATE TABLE public.case_social_insurance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL UNIQUE REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  is_subject text NOT NULL DEFAULT 'unknown',
  exemption_reason text,
  registration_number text,
  registration_status text NOT NULL DEFAULT 'not_registered',
  registration_date date,
  coverage_start_date date,
  coverage_end_date date,
  nationality_category text NOT NULL DEFAULT 'citizen',
  employment_category text NOT NULL DEFAULT 'full_time',
  sector text NOT NULL DEFAULT 'private',
  insurable_wage numeric NOT NULL DEFAULT 0,
  employee_contribution_rate numeric NOT NULL DEFAULT 0,
  employer_contribution_rate numeric NOT NULL DEFAULT 0,
  employee_contribution_amount numeric NOT NULL DEFAULT 0,
  employer_contribution_amount numeric NOT NULL DEFAULT 0,
  total_contribution numeric NOT NULL DEFAULT 0,
  total_due numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  total_difference numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_date date,
  payment_reference text,
  payment_proof_file text,
  currency text NOT NULL DEFAULT 'SAR',
  applied_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_social_insurance TO authenticated;
GRANT ALL ON public.case_social_insurance TO service_role;
ALTER TABLE public.case_social_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own social insurance" ON public.case_social_insurance FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_social_insurance_updated BEFORE UPDATE ON public.case_social_insurance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_case_social_insurance_audit AFTER INSERT OR UPDATE OR DELETE ON public.case_social_insurance
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.case_social_insurance_monthly (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  insurance_id uuid REFERENCES public.case_social_insurance(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contribution_month integer NOT NULL DEFAULT 1,
  contribution_year integer NOT NULL DEFAULT 2024,
  period_key text NOT NULL DEFAULT '',
  actual_wage numeric NOT NULL DEFAULT 0,
  insurable_wage numeric NOT NULL DEFAULT 0,
  registered_wage numeric NOT NULL DEFAULT 0,
  employee_rate numeric NOT NULL DEFAULT 0,
  employer_rate numeric NOT NULL DEFAULT 0,
  employee_contribution numeric NOT NULL DEFAULT 0,
  employer_contribution numeric NOT NULL DEFAULT 0,
  total_contribution numeric NOT NULL DEFAULT 0,
  registration_state text NOT NULL DEFAULT 'registered',
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  difference_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_reference text,
  payment_entity text,
  payment_proof_type text,
  payment_proof_file text,
  currency text NOT NULL DEFAULT 'SAR',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_social_insurance_monthly TO authenticated;
GRANT ALL ON public.case_social_insurance_monthly TO service_role;
ALTER TABLE public.case_social_insurance_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own social insurance months" ON public.case_social_insurance_monthly FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_si_monthly_updated BEFORE UPDATE ON public.case_social_insurance_monthly
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_case_si_monthly_case ON public.case_social_insurance_monthly(case_id, sort_order);

INSERT INTO public.sa_regulatory_settings (key, label, category, description, value)
VALUES (
  'social_insurance',
  'التأمينات الاجتماعية والاشتراكات',
  'insurance',
  'قواعد التأمينات الاجتماعية: النسب والحدود والفروع والاستثناءات وتواريخ السريان',
  jsonb_build_object(
    'system_name', 'المؤسسة العامة للتأمينات الاجتماعية (GOSI)',
    'legal_basis', 'نظام التأمينات الاجتماعية ولوائحه التنفيذية',
    'min_insurable_wage', 1500,
    'max_insurable_wage', 45000,
    'included_allowances', jsonb_build_array('basic_salary','housing_allowance'),
    'excluded_allowances', jsonb_build_array('transport_allowance','communication_allowance','work_nature_allowance','risk_allowance','delegation_allowance','other_allowances','fixed_commission','fixed_bonus','other_benefits'),
    'rate_schedules', jsonb_build_array(
      jsonb_build_object('effective_from','2000-01-01','nationality_category','citizen','employee_rate',0.0975,'employer_rate',0.1175,'branches', jsonb_build_array('المعاشات','الأخطار المهنية','التأمين ضد التعطل')),
      jsonb_build_object('effective_from','2000-01-01','nationality_category','non_citizen','employee_rate',0,'employer_rate',0.02,'branches', jsonb_build_array('الأخطار المهنية'))
    ),
    'exempt_employment_categories', jsonb_build_array('trainee','exempt'),
    'late_penalty_rate', 0.02,
    'notes', 'جميع النسب والحدود قابلة للتحديث من محرك القوانين دون تعديل الكود.'
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;