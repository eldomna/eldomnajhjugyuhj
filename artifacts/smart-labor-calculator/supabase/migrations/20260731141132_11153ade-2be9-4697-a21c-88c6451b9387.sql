CREATE TABLE public._mig_stage (
  id serial PRIMARY KEY,
  fname text NOT NULL,
  body text NOT NULL
);
GRANT SELECT, INSERT, DELETE ON public._mig_stage TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public._mig_stage_id_seq TO authenticated;
GRANT ALL ON public._mig_stage TO service_role;
ALTER TABLE public._mig_stage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access" ON public._mig_stage FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public._mig_apply()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT fname, body FROM public._mig_stage ORDER BY id LOOP
    EXECUTE r.body;
    n := n + 1;
  END LOOP;
  RETURN n || ' files applied';
END $fn$;
REVOKE ALL ON FUNCTION public._mig_apply() FROM PUBLIC, anon, authenticated;