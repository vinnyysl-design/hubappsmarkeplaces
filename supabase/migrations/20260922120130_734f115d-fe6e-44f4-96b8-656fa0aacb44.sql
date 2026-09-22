-- Renomeia o cupom preservando a grafia original
UPDATE public.coupons SET code = 'MeliXp10' WHERE upper(code) = 'EVENTO10';

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    'discount_percent', c.discount_percent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons;
  v jsonb;
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

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, code, discount_percent)
  VALUES (c.id, _user_id, c.code, c.discount_percent);

  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = c.id;

  UPDATE public.profiles SET coupon_code = c.code WHERE id = _user_id;

  RETURN jsonb_build_object(
    'valid', true,
    'code', c.code,
    'discount_percent', c.discount_percent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid) TO authenticated, service_role;