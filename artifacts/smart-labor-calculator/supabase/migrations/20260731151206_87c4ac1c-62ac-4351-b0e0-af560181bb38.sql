-- PART 1F: Annual leave & leave balance compensation
CREATE TABLE public.case_annual_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  service_year integer NOT NULL,
  period_start date,
  period_end date,
  period_days numeric NOT NULL DEFAULT 0,
  entitlement_days numeric NOT NULL DEFAULT 0,
  used_days numeric NOT NULL DEFAULT 0,
  carried_forward_days numeric NOT NULL DEFAULT 0,
  remaining_days numeric NOT NULL DEFAULT 0,
  daily_wage numeric NOT NULL DEFAULT 0,
  compensation_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  legal_basis text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_annual_leave TO authenticated;
GRANT ALL ON public.case_annual_leave TO service_role;
ALTER TABLE public.case_annual_leave ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own annual leave" ON public.case_annual_leave FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_annual_leave_updated BEFORE UPDATE ON public.case_annual_leave
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_leave_taken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  service_year integer,
  start_date date,
  end_date date,
  days numeric NOT NULL DEFAULT 0,
  leave_type text NOT NULL DEFAULT 'annual',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_leave_taken TO authenticated;
GRANT ALL ON public.case_leave_taken TO service_role;
ALTER TABLE public.case_leave_taken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leave taken" ON public.case_leave_taken FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_leave_taken_updated BEFORE UPDATE ON public.case_leave_taken
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_leave_carryover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  from_year integer,
  days numeric NOT NULL DEFAULT 0,
  reason text,
  is_legal boolean NOT NULL DEFAULT true,
  proof_file text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_leave_carryover TO authenticated;
GRANT ALL ON public.case_leave_carryover TO service_role;
ALTER TABLE public.case_leave_carryover ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leave carryover" ON public.case_leave_carryover FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_leave_carryover_updated BEFORE UPDATE ON public.case_leave_carryover
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_leave_settlement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  has_leave_claim boolean NOT NULL DEFAULT false,
  has_carryover boolean NOT NULL DEFAULT false,
  still_employed boolean NOT NULL DEFAULT false,
  wage_changed boolean NOT NULL DEFAULT false,
  wage_basis text NOT NULL DEFAULT 'last_actual_wage',
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  compensation_amount numeric NOT NULL DEFAULT 0,
  daily_wage numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  payment_date date,
  payment_method text,
  proof_type text,
  proof_file text,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_leave_settlement TO authenticated;
GRANT ALL ON public.case_leave_settlement TO service_role;
ALTER TABLE public.case_leave_settlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leave settlement" ON public.case_leave_settlement FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_leave_settlement_updated BEFORE UPDATE ON public.case_leave_settlement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Leave policy knobs manageable from the legal rules engine (no code changes needed)
UPDATE public.sa_regulatory_settings
   SET value = value || jsonb_build_object(
        'max_carryover_days', 30,
        'carryover_validity_months', 12,
        'cash_compensation_allowed', true,
        'compensation_wage_basis', 'last_actual_wage',
        'compensation_on_active_employment', false,
        'prorate_partial_year', true)
 WHERE key = 'annual_leave';