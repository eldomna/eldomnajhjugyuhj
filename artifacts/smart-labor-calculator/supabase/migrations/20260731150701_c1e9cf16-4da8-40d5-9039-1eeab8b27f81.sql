CREATE TABLE public.unpaid_salary_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.unpaid_salary_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unpaid_salary_types TO authenticated;
GRANT ALL ON public.unpaid_salary_types TO service_role;
ALTER TABLE public.unpaid_salary_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types readable" ON public.unpaid_salary_types FOR SELECT USING (true);
CREATE POLICY "admins manage types" ON public.unpaid_salary_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_unpaid_types_touch BEFORE UPDATE ON public.unpaid_salary_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.unpaid_salary_types (code, name, sort_order) VALUES
  ('monthly_salary','راتب شهري',1),
  ('partial_salary','راتب جزئي',2),
  ('bonus','مكافأة',3),
  ('commission','عمولة',4),
  ('housing_allowance','بدل سكن',5),
  ('transport_allowance','بدل نقل',6),
  ('communication_allowance','بدل اتصالات',7),
  ('work_nature_allowance','بدل طبيعة عمل',8),
  ('other_allowance','بدل آخر',9),
  ('incentives','حوافز',10),
  ('salary_differences','فروقات رواتب',11),
  ('promotion_differences','فروقات ترقيات',12),
  ('other_dues','مستحقات أخرى',13);

CREATE TABLE public.case_unpaid_salaries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_drafts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  month integer,
  year integer,
  due_date date,
  salary_type text not null default 'monthly_salary',
  amount numeric not null default 0,
  currency text not null default 'SAR',
  payment_status text not null default 'unpaid',
  paid_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  payment_date date,
  payment_method text,
  proof_type text,
  proof_file text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_unpaid_salaries TO authenticated;
GRANT ALL ON public.case_unpaid_salaries TO service_role;
ALTER TABLE public.case_unpaid_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unpaid salaries" ON public.case_unpaid_salaries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_case_unpaid_touch BEFORE UPDATE ON public.case_unpaid_salaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "own proof files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "own proof files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own proof files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'case-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own proof files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);