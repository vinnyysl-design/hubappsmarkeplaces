CREATE OR REPLACE FUNCTION public.prevent_non_admin_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_status_change ON public.profiles;
CREATE TRIGGER profiles_prevent_status_change
BEFORE UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_status_change();