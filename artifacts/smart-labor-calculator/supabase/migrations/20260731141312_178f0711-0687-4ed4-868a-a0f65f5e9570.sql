DROP FUNCTION IF EXISTS public._mig_apply();
DROP TABLE IF EXISTS public._mig_stage;
CREATE SCHEMA IF NOT EXISTS mig;
CREATE TABLE mig.stage (id serial PRIMARY KEY, fname text NOT NULL, body text NOT NULL);
GRANT USAGE ON SCHEMA mig TO sandbox_exec;
GRANT SELECT, INSERT, DELETE ON mig.stage TO sandbox_exec;
GRANT USAGE, SELECT ON SEQUENCE mig.stage_id_seq TO sandbox_exec;
CREATE OR REPLACE FUNCTION mig.apply()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT fname, body FROM mig.stage ORDER BY id LOOP
    EXECUTE r.body;
    n := n + 1;
  END LOOP;
  RETURN n || ' files applied';
END $fn$;