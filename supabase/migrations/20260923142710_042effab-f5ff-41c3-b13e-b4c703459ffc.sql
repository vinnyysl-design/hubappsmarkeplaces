-- 1) Novos campos de regra nos cupons
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'discount',
  ADD COLUMN IF NOT EXISTS grants_trial boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS free_days integer,
  ADD COLUMN IF NOT EXISTS purpose text;

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_kind_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_kind_check CHECK (kind IN ('discount','free_access'));

ALTER TABLE public.coupons ALTER COLUMN discount_percent DROP NOT NULL;

-- 2) Registro de uso guarda o snapshot da regra
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'discount',
  ADD COLUMN IF NOT EXISTS free_days integer,
  ADD COLUMN IF NOT EXISTS granted_until timestamptz;

ALTER TABLE public.coupon_redemptions ALTER COLUMN discount_percent DROP NOT NULL;

-- 3) Acesso grátis por tempo limitado (cortesia com prazo)
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
  v_sub_ends TIMESTAMPTZ;
BEGIN
  SELECT p.status, p.phone_verified, p.trial_started_at, p.plan, p.subscription_ends_at
    INTO v_status, v_phone_verified, v_trial_started, v_plan, v_sub_ends
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  -- cortesia: expira apenas se tiver prazo definido (ex: cupom de acesso grátis)
  IF v_plan = 'cortesia' THEN
    IF v_sub_ends IS NOT NULL AND now() > v_sub_ends THEN
      IF v_status <> 'bloqueado'::user_status THEN
        UPDATE public.profiles
        SET status = 'bloqueado'::user_status, updated_at = now()
        WHERE id = _user_id;
      END IF;
      RETURN QUERY SELECT 'bloqueado'::user_status, true, v_sub_ends;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_status, false, v_sub_ends;
    RETURN;
  END IF;

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

-- 4) validate_coupon expõe as regras
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons;
BEGIN
  IF _code IS NULL OR btrim(_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;

  SELECT * INTO c FROM public.coupons
  WHERE upper(code) = upper(btrim(_code))
  LIMIT 1;

  IF c.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF NOT c.active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF c.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_started');
  END IF;
  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'exhausted');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', c.code,
    'kind', c.kind,
    'grants_trial', c.grants_trial,
    'free_days', c.free_days,
    'purpose', c.purpose,
    'description', c.description,
    'discount_percent', c.discount_percent
  );
END;
$function$;

-- 5) redeem_coupon aplica a regra do cupom
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons;
  v jsonb;
  v_granted_until timestamptz;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v := public.validate_coupon(_code);
  IF NOT (v ->> 'valid')::boolean THEN
    RETURN v;
  END IF;

  SELECT * INTO c FROM public.coupons
  WHERE upper(code) = upper(btrim(_code))
  FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE user_id = _user_id) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_redeemed');
  END IF;

  IF c.kind = 'free_access' AND COALESCE(c.free_days, 0) > 0 THEN
    v_granted_until := now() + (c.free_days || ' days')::interval;
  END IF;

  INSERT INTO public.coupon_redemptions
    (coupon_id, user_id, code, discount_percent, kind, free_days, granted_until)
  VALUES
    (c.id, _user_id, c.code, c.discount_percent, c.kind, c.free_days, v_granted_until);

  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = c.id;

  IF c.kind = 'free_access' AND v_granted_until IS NOT NULL THEN
    -- acesso grátis por prazo definido: entra como cortesia com data de término
    UPDATE public.profiles
    SET coupon_code = c.code,
        plan = 'cortesia'::user_plan,
        subscription_started_at = now(),
        subscription_ends_at = v_granted_until,
        trial_status = CASE WHEN c.grants_trial THEN trial_status ELSE 'expirado' END,
        trial_started_at = CASE WHEN c.grants_trial THEN trial_started_at ELSE NULL END,
        updated_at = now()
    WHERE id = _user_id;
  ELSIF NOT c.grants_trial THEN
    -- cupom sem direito aos 10 dias grátis: trial encerrado na hora
    UPDATE public.profiles
    SET coupon_code = c.code,
        trial_status = 'expirado',
        trial_started_at = now() - INTERVAL '10 days',
        updated_at = now()
    WHERE id = _user_id;
  ELSE
    UPDATE public.profiles SET coupon_code = c.code, updated_at = now() WHERE id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', c.code,
    'kind', c.kind,
    'grants_trial', c.grants_trial,
    'free_days', c.free_days,
    'granted_until', v_granted_until,
    'discount_percent', c.discount_percent
  );
END;
$function$;