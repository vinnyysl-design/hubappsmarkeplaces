ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS partner_token text;

CREATE UNIQUE INDEX IF NOT EXISTS coupons_partner_token_key ON public.coupons (partner_token) WHERE partner_token IS NOT NULL;

-- cupons de parceiros (10% no 1o mes, mantem os 10 dias gratis)
INSERT INTO public.coupons (code, kind, grants_trial, discount_percent, purpose, description, partner_name, partner_token, active)
VALUES
  ('L&A10FF',      'discount', true, 10, 'Parceria L&A',      'Desconto de 10% no primeiro mês', 'L&A',       encode(gen_random_bytes(12), 'hex'), true),
  ('NUCLOEO10OFF', 'discount', true, 10, 'Parceria Nucloeo',  'Desconto de 10% no primeiro mês', 'Nucloeo',   encode(gen_random_bytes(12), 'hex'), true),
  ('NEXIA10OFF',   'discount', true, 10, 'Parceria Nexia',    'Desconto de 10% no primeiro mês', 'Nexia',     encode(gen_random_bytes(12), 'hex'), true),
  ('OUT10OFF',     'discount', true, 10, 'Parceria Out',      'Desconto de 10% no primeiro mês', 'Out',       encode(gen_random_bytes(12), 'hex'), true)
ON CONFLICT DO NOTHING;

-- garante token para qualquer cupom que ja exista com esses codigos
UPDATE public.coupons
SET partner_token = encode(gen_random_bytes(12), 'hex'),
    partner_name = COALESCE(partner_name, initcap(split_part(code, '10', 1)))
WHERE partner_token IS NULL
  AND upper(code) IN ('L&A10FF', 'NUCLOEO10OFF', 'NEXIA10OFF', 'OUT10OFF');

CREATE OR REPLACE FUNCTION public.get_partner_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons;
  v_leads jsonb;
  v_closed int;
BEGIN
  IF _token IS NULL OR btrim(_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO c FROM public.coupons WHERE partner_token = btrim(_token) LIMIT 1;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC), '[]'::jsonb) INTO v_leads
  FROM (
    SELECT jsonb_build_object(
      'nome', COALESCE(NULLIF(btrim(p.display_name), ''), split_part(COALESCE(p.email, ''), '@', 1)),
      'plano', CASE
        WHEN p.plan <> 'pagante' THEN NULL
        WHEN p.subscription_plan_id = 'mensal' THEN 'Mensal'
        WHEN p.subscription_plan_id = 'trimestral' THEN '3 meses'
        WHEN p.subscription_plan_id = 'semestral' THEN '6 meses'
        WHEN p.subscription_plan_id = 'anual' THEN '12 meses'
        ELSE 'Assinatura ativa'
      END,
      'fechou', (p.plan = 'pagante'),
      'status', CASE
        WHEN p.plan = 'pagante' THEN 'Assinou'
        WHEN p.trial_status = 'expirado' OR p.status = 'bloqueado' THEN 'Teste expirado'
        ELSE 'Em teste'
      END,
      'data', r.applied_at
    ) AS x
    FROM public.coupon_redemptions r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.coupon_id = c.id
  ) s;

  SELECT COUNT(*) INTO v_closed
  FROM public.coupon_redemptions r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.coupon_id = c.id AND p.plan = 'pagante';

  RETURN jsonb_build_object(
    'ok', true,
    'code', c.code,
    'partner_name', c.partner_name,
    'discount_percent', c.discount_percent,
    'total_leads', jsonb_array_length(v_leads),
    'total_closed', v_closed,
    'generated_at', now(),
    'leads', v_leads
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_report(text) TO anon, authenticated, service_role;