ALTER TABLE public.platform_settings 
  ADD COLUMN IF NOT EXISTS default_clauses text,
  ADD COLUMN IF NOT EXISTS report_footer text;