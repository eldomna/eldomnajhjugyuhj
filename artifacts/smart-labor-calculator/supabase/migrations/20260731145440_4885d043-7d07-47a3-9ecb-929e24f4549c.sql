CREATE TABLE public.contract_trial_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.case_contracts(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  has_trial_period boolean NOT NULL DEFAULT false,
  trial_start_date date,
  trial_duration_days integer,
  trial_end_date date,
  is_extended boolean NOT NULL DEFAULT false,
  extension_duration_days integer,
  extension_reason text,
  extension_start_date date,
  extension_end_date date,
  termination_right text,
  ended_during_trial boolean NOT NULL DEFAULT false,
  who_terminated text,
  re_trial_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_trial_periods_unique UNIQUE (contract_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_trial_periods TO authenticated;
GRANT ALL ON public.contract_trial_periods TO service_role;
ALTER TABLE public.contract_trial_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_periods_own" ON public.contract_trial_periods FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.case_drafts d WHERE d.id = case_id AND d.user_id = auth.uid()));
CREATE INDEX contract_trial_periods_case_idx ON public.contract_trial_periods (case_id);
CREATE TRIGGER contract_trial_periods_touch BEFORE UPDATE ON public.contract_trial_periods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_salaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  basic_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  communication_allowance numeric NOT NULL DEFAULT 0,
  work_nature_allowance numeric NOT NULL DEFAULT 0,
  risk_allowance numeric NOT NULL DEFAULT 0,
  delegation_allowance numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  fixed_commission numeric NOT NULL DEFAULT 0,
  fixed_bonus numeric NOT NULL DEFAULT 0,
  other_benefits numeric NOT NULL DEFAULT 0,
  actual_salary numeric NOT NULL DEFAULT 0,
  daily_salary numeric NOT NULL DEFAULT 0,
  hourly_salary numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_salaries_unique UNIQUE (case_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_salaries TO authenticated;
GRANT ALL ON public.case_salaries TO service_role;
ALTER TABLE public.case_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_salaries_own" ON public.case_salaries FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.case_drafts d WHERE d.id = case_id AND d.user_id = auth.uid()));
CREATE TRIGGER case_salaries_touch BEFORE UPDATE ON public.case_salaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();