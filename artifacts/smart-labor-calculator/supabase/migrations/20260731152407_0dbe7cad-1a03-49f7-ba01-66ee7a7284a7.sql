CREATE TABLE public.case_maternity_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL UNIQUE REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  gender text NOT NULL DEFAULT 'female',
  had_pregnancy boolean NOT NULL DEFAULT false,
  pregnancy_start_date date,
  delivery_date date,
  actual_delivery_date date,
  delivery_type text,
  early_delivery boolean NOT NULL DEFAULT false,
  multiple_birth text,
  newborn_deceased boolean NOT NULL DEFAULT false,
  medical_complications boolean NOT NULL DEFAULT false,
  has_medical_document boolean NOT NULL DEFAULT false,
  medical_document_type text,
  medical_report_file text,
  ended_during_protection boolean NOT NULL DEFAULT false,
  termination_reason text,
  termination_date date,
  termination_party text,
  termination_proof_file text,
  wage_changed boolean NOT NULL DEFAULT false,
  wage_basis text NOT NULL DEFAULT 'last_actual_wage',
  returned_to_work boolean NOT NULL DEFAULT false,
  is_nursing boolean NOT NULL DEFAULT false,
  daily_wage numeric NOT NULL DEFAULT 0,
  total_due numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  excluded_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_maternity_summary TO authenticated;
GRANT ALL ON public.case_maternity_summary TO service_role;
ALTER TABLE public.case_maternity_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own maternity summary" ON public.case_maternity_summary FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_maternity_summary_updated BEFORE UPDATE ON public.case_maternity_summary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_maternity_leaves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contract_id uuid,
  pregnancy_start_date date,
  delivery_date date,
  leave_start date,
  leave_end date,
  return_to_work_date date,
  leave_days numeric NOT NULL DEFAULT 0,
  extended boolean NOT NULL DEFAULT false,
  extension_reason text,
  extension_days numeric NOT NULL DEFAULT 0,
  has_document boolean NOT NULL DEFAULT false,
  medical_report_file text,
  daily_wage numeric NOT NULL DEFAULT 0,
  compensation_rate numeric NOT NULL DEFAULT 0,
  compensation_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_date date,
  payment_proof_file text,
  currency text NOT NULL DEFAULT 'SAR',
  applied_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_maternity_leaves TO authenticated;
GRANT ALL ON public.case_maternity_leaves TO service_role;
ALTER TABLE public.case_maternity_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own maternity leaves" ON public.case_maternity_leaves FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_maternity_leaves_updated BEFORE UPDATE ON public.case_maternity_leaves
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_nursing_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  delivery_date date,
  return_to_work_date date,
  nursing_start_date date,
  nursing_end_date date,
  daily_working_hours numeric NOT NULL DEFAULT 8,
  daily_reduction_hours numeric NOT NULL DEFAULT 1,
  total_eligible_days numeric NOT NULL DEFAULT 0,
  total_reduction_hours numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT true,
  applied_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_nursing_hours TO authenticated;
GRANT ALL ON public.case_nursing_hours TO service_role;
ALTER TABLE public.case_nursing_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nursing hours" ON public.case_nursing_hours FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_nursing_hours_updated BEFORE UPDATE ON public.case_nursing_hours
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.sa_regulatory_settings (key, label, description, value)
VALUES
 ('maternity_leave', 'سياسة إجازة الأمومة', 'مدة الإجازة ونسبة الأجر والتمديد والحماية من الإنهاء', '{
   "total_days": 84,
   "pre_delivery_days": 28,
   "wage_rate": 1.0,
   "wage_rate_scale": [{"min_service_years": 0, "rate": 0.5}, {"min_service_years": 1, "rate": 0.5}, {"min_service_years": 3, "rate": 1.0}],
   "max_extension_days": 30,
   "extension_paid": false,
   "complication_extra_days": 30,
   "multiple_birth_extra_days": 0,
   "newborn_death_extra_days": 0,
   "termination_protected": true,
   "protection_window_days": 180,
   "wage_basis": "last_actual_wage",
   "requires_medical_report": true,
   "legal_basis": "المواد 151 و152 و155 من نظام العمل السعودي"
 }'::jsonb),
 ('nursing_hour', 'سياسة ساعة الرضاعة', 'مدة الاستفادة وساعات التخفيض اليومية ومدفوعة الأجر', '{
   "daily_reduction_hours": 1,
   "eligible_months": 6,
   "paid": true,
   "can_accumulate": true,
   "starts_from": "return_to_work",
   "legal_basis": "المادة 151 من نظام العمل السعودي واللائحة التنفيذية"
 }'::jsonb)
ON CONFLICT (key) DO NOTHING;