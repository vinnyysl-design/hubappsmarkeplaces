
DROP VIEW IF EXISTS public.suspicious_accounts;

CREATE VIEW public.suspicious_accounts
WITH (security_invoker = true) AS
SELECT
  sf.fingerprint,
  COUNT(DISTINCT sf.user_id) AS account_count,
  array_agg(DISTINCT sf.user_id) AS user_ids,
  array_agg(DISTINCT p.email) AS emails,
  array_agg(DISTINCT sf.ip_address) AS ips,
  MIN(sf.created_at) AS first_seen,
  MAX(sf.created_at) AS last_seen
FROM public.signup_fingerprints sf
LEFT JOIN public.profiles p ON p.id = sf.user_id
WHERE sf.fingerprint IS NOT NULL AND sf.fingerprint <> ''
GROUP BY sf.fingerprint
HAVING COUNT(DISTINCT sf.user_id) > 1;

GRANT SELECT ON public.suspicious_accounts TO authenticated;
