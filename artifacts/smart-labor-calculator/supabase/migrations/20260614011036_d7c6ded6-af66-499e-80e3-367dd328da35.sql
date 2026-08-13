
-- Protect lawyer verification fields from self-modification
DROP TRIGGER IF EXISTS trg_protect_lawyer_verification ON public.lawyers;
CREATE TRIGGER trg_protect_lawyer_verification
BEFORE UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.protect_lawyer_verification();

-- Keep avg_rating and reviews_count in sync
DROP TRIGGER IF EXISTS trg_recalc_lawyer_rating ON public.lawyer_reviews;
CREATE TRIGGER trg_recalc_lawyer_rating
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_lawyer_rating();

-- Touch updated_at on lawyers
DROP TRIGGER IF EXISTS trg_touch_lawyers_updated_at ON public.lawyers;
CREATE TRIGGER trg_touch_lawyers_updated_at
BEFORE UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
