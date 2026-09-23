ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS partner_logo_url text;

CREATE OR REPLACE FUNCTION public.get_partner_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons;
  v_leads jsonb;
  v_closed int;
  v_monthly jsonb;
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

  WITH paid_dates AS (
    SELECT
      r.user_id,
      COALESCE(MIN(pay.paid_at)::timestamptz, MIN(r.applied_at)) AS paid_at
    FROM public.coupon_redemptions r
    JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN public.payments pay
      ON pay.user_id = r.user_id
      AND pay.paid_at >= r.applied_at::date
    WHERE r.coupon_id = c.id
      AND p.plan = 'pagante'
    GROUP BY r.user_id
  ), closed_by_month AS (
    SELECT date_trunc('month', paid_at) AS month_start, COUNT(*)::int AS closed
    FROM paid_dates
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(m.month_start, 'YYYY-MM'),
        'closed', COALESCE(cbm.closed, 0)
      )
      ORDER BY m.month_start
    ),
    '[]'::jsonb
  ) INTO v_monthly
  FROM generate_series(
    date_trunc('month', now()) - INTERVAL '11 months',
    date_trunc('month', now()),
    INTERVAL '1 month'
  ) AS m(month_start)
  LEFT JOIN closed_by_month cbm ON cbm.month_start = m.month_start;

  RETURN jsonb_build_object(
    'ok', true,
    'code', c.code,
    'partner_name', c.partner_name,
    'partner_logo_url', c.partner_logo_url,
    'discount_percent', c.discount_percent,
    'total_leads', jsonb_array_length(v_leads),
    'total_closed', v_closed,
    'monthly_closed', v_monthly,
    'generated_at', now(),
    'leads', v_leads
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_partner_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_report(text) TO anon, authenticated, service_role;