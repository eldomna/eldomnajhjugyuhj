CREATE SEQUENCE IF NOT EXISTS public.sa_report_seq START 1;

CREATE TABLE public.sa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text NOT NULL UNIQUE,
  version integer NOT NULL DEFAULT 1,
  case_id uuid REFERENCES public.sa_cases(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  plan_code text NOT NULL,
  employee_label text,
  employer_label text,
  net_total numeric NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  deductions_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  document jsonb NOT NULL,
  checksum text NOT NULL,
  downloads integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sa_reports TO authenticated;
GRANT ALL ON public.sa_reports TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sa_report_seq TO authenticated, service_role;

ALTER TABLE public.sa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reports"
  ON public.sa_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own reports"
  ON public.sa_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins archive reports"
  ON public.sa_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX sa_reports_user_idx ON public.sa_reports (user_id, created_at DESC);
CREATE INDEX sa_reports_case_idx ON public.sa_reports (case_id);

CREATE POLICY "Admins read calculation audit"
  ON public.sa_case_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));