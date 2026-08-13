CREATE TABLE public.case_working_hours (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_drafts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  daily_hours numeric not null default 8,
  weekly_days integer not null default 6,
  shift_type text not null default 'morning',
  fingerprint_system boolean not null default false,
  attendance_system boolean not null default false,
  has_overtime boolean not null default false,
  overtime_entry_mode text not null default 'total',
  overtime_total_hours numeric not null default 0,
  has_weekend_work boolean not null default false,
  has_holiday_work boolean not null default false,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_working_hours TO authenticated;
GRANT ALL ON public.case_working_hours TO service_role;
ALTER TABLE public.case_working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own working hours" ON public.case_working_hours FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_working_hours_touch BEFORE UPDATE ON public.case_working_hours FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_overtime (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_drafts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  start_date date,
  end_date date,
  period_label text,
  hours numeric not null default 0,
  reason text,
  notes text,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_overtime TO authenticated;
GRANT ALL ON public.case_overtime TO service_role;
ALTER TABLE public.case_overtime ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own overtime" ON public.case_overtime FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_overtime_touch BEFORE UPDATE ON public.case_overtime FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_weekend_work (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_drafts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  start_date date,
  end_date date,
  days numeric not null default 0,
  hours numeric not null default 0,
  notes text,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_weekend_work TO authenticated;
GRANT ALL ON public.case_weekend_work TO service_role;
ALTER TABLE public.case_weekend_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekend work" ON public.case_weekend_work FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_weekend_work_touch BEFORE UPDATE ON public.case_weekend_work FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_holiday_work (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_drafts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  holiday_name text,
  holiday_date date,
  end_date date,
  days numeric not null default 0,
  hours numeric not null default 0,
  compensated boolean not null default false,
  notes text,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_holiday_work TO authenticated;
GRANT ALL ON public.case_holiday_work TO service_role;
ALTER TABLE public.case_holiday_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holiday work" ON public.case_holiday_work FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_holiday_work_touch BEFORE UPDATE ON public.case_holiday_work FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();