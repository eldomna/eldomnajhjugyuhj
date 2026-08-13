-- PART 1G: Sick leave management
CREATE TABLE public.case_sick_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contract_id uuid REFERENCES public.case_contracts(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  total_days numeric NOT NULL DEFAULT 0,
  leave_kind text NOT NULL DEFAULT 'sick',
  illness_reason text,
  medical_provider text,
  medical_report_number text,
  has_medical_report boolean NOT NULL DEFAULT false,
  medical_report_type text,
  medical_report_file text,
  daily_wage numeric NOT NULL DEFAULT 0,
  compensation_rate numeric NOT NULL DEFAULT 0,
  compensation_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_date date,
  proof_type text,
  proof_file text,
  currency text NOT NULL DEFAULT 'SAR',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_sick_leaves TO authenticated;
GRANT ALL ON public.case_sick_leaves TO service_role;
ALTER TABLE public.case_sick_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sick leaves" ON public.case_sick_leaves FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_sick_leaves_updated BEFORE UPDATE ON public.case_sick_leaves
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_sick_leave_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  has_sick_leave boolean NOT NULL DEFAULT false,
  ended_during_sick_leave boolean NOT NULL DEFAULT false,
  wage_changed boolean NOT NULL DEFAULT false,
  wage_basis text NOT NULL DEFAULT 'last_actual_wage',
  leaves_count integer NOT NULL DEFAULT 0,
  total_days numeric NOT NULL DEFAULT 0,
  total_due numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  excluded_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  daily_wage numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_sick_leave_summary TO authenticated;
GRANT ALL ON public.case_sick_leave_summary TO service_role;
ALTER TABLE public.case_sick_leave_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sick leave summary" ON public.case_sick_leave_summary FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_sick_leave_summary_updated BEFORE UPDATE ON public.case_sick_leave_summary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sick leave policy knobs manageable from the legal rules engine
UPDATE public.sa_regulatory_settings
   SET value = value || jsonb_build_object(
        'annual_max_days', 120,
        'requires_medical_report', true,
        'year_reset', 'rolling_year',
        'wage_basis', 'last_actual_wage',
        'service_end_during_leave', 'pay_until_end_date',
        'aggregate_across_leaves', true)
 WHERE key = 'sick_leave';