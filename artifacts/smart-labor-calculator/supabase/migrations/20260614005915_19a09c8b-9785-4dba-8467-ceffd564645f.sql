-- Add 'lawyer' value to app_role enum so lawyer accounts can later access a dedicated portal.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lawyer';