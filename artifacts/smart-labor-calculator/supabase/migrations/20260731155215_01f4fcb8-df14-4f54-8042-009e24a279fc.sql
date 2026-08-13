CREATE TABLE public.case_termination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  employment_status text NOT NULL DEFAULT 'unknown',
  termination_reason text,
  termination_category text,
  reason_details text,
  incident_description text,
  incident_date date,
  initiated_by text,
  termination_date date,
  last_working_day date,
  effective_termination_date date,
  notice_given boolean NOT NULL DEFAULT false,
  notice_date date,
  notice_period_days integer,
  notice_method text,
  has_document boolean NOT NULL DEFAULT false,
  legal_analysis_status text,
  legal_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_termination_case_unique UNIQUE (case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_termination TO authenticated;
GRANT ALL ON public.case_termination TO service_role;
ALTER TABLE public.case_termination ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_termination_own ON public.case_termination FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER case_termination_touch BEFORE UPDATE ON public.case_termination
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_termination_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  termination_id uuid REFERENCES public.case_termination(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  doc_type text NOT NULL DEFAULT 'other',
  doc_date date,
  file_path text,
  issuer text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_termination_documents TO authenticated;
GRANT ALL ON public.case_termination_documents TO service_role;
ALTER TABLE public.case_termination_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_termination_documents_own ON public.case_termination_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX case_termination_documents_case_idx ON public.case_termination_documents(case_id, sort_order);
