CREATE OR REPLACE FUNCTION public.enforce_trial_status(_user_id uuid)
RETURNS TABLE(status user_status, trial_expired boolean, trial_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at timestamptz;
  v_status user_status;
  v_is_admin boolean;
  v_has_payment boolean;
  v_trial_ends timestamptz;
  v_expired boolean := false;
BEGIN
  SELECT p.created_at, p.status INTO v_created_at, v_status
  FROM public.profiles p WHERE p.id = _user_id;

  IF v_created_at IS NULL THEN
    RETURN QUERY SELECT NULL::user_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  v_trial_ends := v_created_at + INTERVAL '3 days';

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    INTO v_is_admin;

  SELECT EXISTS(SELECT 1 FROM public.payments WHERE user_id = _user_id)
    INTO v_has_payment;

  IF NOT v_is_admin AND NOT v_has_payment AND now() > v_trial_ends AND v_status = 'ativo' THEN
    UPDATE public.profiles SET status = 'bloqueado' WHERE id = _user_id;
    v_status := 'bloqueado';
    v_expired := true;
  ELSIF NOT v_is_admin AND NOT v_has_payment AND now() > v_trial_ends THEN
    v_expired := true;
  END IF;

  RETURN QUERY SELECT v_status, v_expired, v_trial_ends;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_trial_status(uuid) TO authenticated, anon, service_role;