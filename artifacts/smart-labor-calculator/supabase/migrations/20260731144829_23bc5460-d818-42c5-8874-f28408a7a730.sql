CREATE TABLE IF NOT EXISTS public.case_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contract_number text NOT NULL,
  contract_name text,
  start_date date NOT NULL,
  end_date date,
  joining_date date,
  contract_type text NOT NULL DEFAULT 'fixed_term',
  is_qiwa_documented boolean NOT NULL DEFAULT false,
  qiwa_contract_number text,
  renewed boolean NOT NULL DEFAULT false,
  renew_count integer NOT NULL DEFAULT 0,
  renew_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ended boolean NOT NULL DEFAULT false,
  end_reason text,
  actual_end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS case_contracts_case_idx ON public.case_contracts (case_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS case_contracts_unique_number
  ON public.case_contracts (case_id, lower(contract_number)) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_contracts TO authenticated;
GRANT ALL ON public.case_contracts TO service_role;

ALTER TABLE public.case_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_contracts_own" ON public.case_contracts;
CREATE POLICY "case_contracts_own" ON public.case_contracts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.case_drafts d WHERE d.id = case_id AND d.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS case_contracts_touch ON public.case_contracts;
CREATE TRIGGER case_contracts_touch BEFORE UPDATE ON public.case_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();