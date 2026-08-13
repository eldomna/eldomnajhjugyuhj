ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS display_seconds integer NOT NULL DEFAULT 10
    CHECK (display_seconds BETWEEN 2 AND 120);
