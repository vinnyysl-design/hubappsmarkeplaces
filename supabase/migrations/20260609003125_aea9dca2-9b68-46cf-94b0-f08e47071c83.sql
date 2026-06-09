CREATE OR REPLACE FUNCTION public.enforce_trial_status(_user_id uuid)
 RETURNS TABLE(status user_status, trial_expired boolean, trial_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status public.user_status;
  v_phone_verified BOOLEAN;
  v_trial_started TIMESTAMPTZ;
  v_trial_ends TIMESTAMPTZ;
  v_plan public.user_plan;
  v_next_due DATE;
BEGIN
  SELECT p.status, p.phone_verified, p.trial_started_at, p.plan
    INTO v_status, v_phone_verified, v_trial_started, v_plan
  FROM public.profiles p
  WHERE p.id = _user_id;

  -- admin nunca expira
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  -- cortesia: nunca expira
  IF v_plan = 'cortesia' THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  -- pagante: bloqueia se passou da data de vencimento
  IF v_plan = 'pagante' THEN
    SELECT MAX(next_due_date) INTO v_next_due
    FROM public.payments
    WHERE user_id = _user_id;

    IF v_next_due IS NULL OR v_next_due < CURRENT_DATE THEN
      IF v_status <> 'bloqueado'::user_status THEN
        UPDATE public.profiles
        SET status = 'bloqueado'::user_status, updated_at = now()
        WHERE id = _user_id;
      END IF;
      RETURN QUERY SELECT 'bloqueado'::user_status, true,
        CASE WHEN v_next_due IS NULL THEN NULL ELSE (v_next_due + 1)::timestamptz END;
      RETURN;
    ELSE
      -- desbloqueia automaticamente se o pagamento foi recebido (webhook ou admin)
      IF v_status = 'bloqueado'::user_status THEN
        UPDATE public.profiles
        SET status = 'ativo'::user_status, updated_at = now()
        WHERE id = _user_id;
        v_status := 'ativo'::user_status;
      END IF;
      RETURN QUERY SELECT v_status, false, (v_next_due + 1)::timestamptz;
      RETURN;
    END IF;
  END IF;

  -- trial: lógica existente
  IF NOT COALESCE(v_phone_verified, FALSE) OR v_trial_started IS NULL THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  v_trial_ends := v_trial_started + INTERVAL '10 days';

  IF now() > v_trial_ends THEN
    UPDATE public.profiles
    SET status = 'bloqueado'::user_status,
        trial_status = 'expirado',
        updated_at = now()
    WHERE id = _user_id;
    RETURN QUERY SELECT 'bloqueado'::user_status, true, v_trial_ends;
  ELSE
    RETURN QUERY SELECT v_status, false, v_trial_ends;
  END IF;
END;
$function$;