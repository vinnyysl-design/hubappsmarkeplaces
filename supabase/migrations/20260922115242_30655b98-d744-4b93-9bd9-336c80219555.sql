-- ============ COUPONS ============
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  description text,
  discount_percent numeric NOT NULL DEFAULT 10 CHECK (discount_percent > 0 AND discount_percent <= 100),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX coupons_code_key ON public.coupons (upper(code));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER coupons_set_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REDEMPTIONS ============
CREATE TABLE public.coupon_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL,
  discount_percent numeric NOT NULL,
  first_payment_done boolean NOT NULL DEFAULT false,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemption" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER coupon_redemptions_set_updated_at
  BEFORE UPDATE ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROFILE COLUMN ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coupon_code text;

-- ============ VALIDATE ============
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
    'code', upper(c.code),
    'discount_percent', c.discount_percent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated, service_role;

-- ============ REDEEM ============
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
  VALUES (c.id, _user_id, upper(c.code), c.discount_percent);

  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = c.id;

  UPDATE public.profiles SET coupon_code = upper(c.code) WHERE id = _user_id;

  RETURN jsonb_build_object(
    'valid', true,
    'code', upper(c.code),
    'discount_percent', c.discount_percent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid) TO authenticated, service_role;