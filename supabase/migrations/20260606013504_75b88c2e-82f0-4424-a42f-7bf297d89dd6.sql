
-- 1. Função de normalização de email (remove pontos e +alias do Gmail, lowercase)
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_email text;
  v_local text;
  v_domain text;
BEGIN
  IF _email IS NULL OR _email = '' THEN
    RETURN NULL;
  END IF;
  v_email := lower(trim(_email));
  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);
  IF v_domain = '' THEN
    RETURN v_email;
  END IF;
  -- Remove tudo depois do '+'
  v_local := split_part(v_local, '+', 1);
  -- Para Gmail/Googlemail: remove pontos e unifica domínio
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  END IF;
  RETURN v_local || '@' || v_domain;
END;
$$;

-- 2. Adiciona coluna email_normalized em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_normalized text;

-- Preenche para usuários existentes
UPDATE public.profiles
SET email_normalized = public.normalize_email(email)
WHERE email_normalized IS NULL AND email IS NOT NULL;

-- Índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_normalized_unique
  ON public.profiles (email_normalized)
  WHERE email_normalized IS NOT NULL;

-- 3. Trigger para auto-popular email_normalized
CREATE OR REPLACE FUNCTION public.profiles_set_email_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email_normalized := public.normalize_email(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_email_normalized ON public.profiles;
CREATE TRIGGER trg_profiles_email_normalized
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_set_email_normalized();

-- 4. Tabela de domínios descartáveis
CREATE TABLE IF NOT EXISTS public.disposable_email_domains (
  domain text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.disposable_email_domains TO anon, authenticated;
GRANT ALL ON public.disposable_email_domains TO service_role;

ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read disposable domains"
  ON public.disposable_email_domains FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage disposable domains"
  ON public.disposable_email_domains FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed dos mais comuns
INSERT INTO public.disposable_email_domains (domain) VALUES
  ('mailinator.com'),('10minutemail.com'),('guerrillamail.com'),('guerrillamail.info'),
  ('tempmail.com'),('temp-mail.org'),('temp-mail.io'),('throwaway.email'),('throwawaymail.com'),
  ('yopmail.com'),('getnada.com'),('nada.email'),('maildrop.cc'),('dispostable.com'),
  ('trashmail.com'),('trashmail.de'),('sharklasers.com'),('spam4.me'),('mintemail.com'),
  ('mailnesia.com'),('fakeinbox.com'),('mailcatch.com'),('mohmal.com'),('emailondeck.com'),
  ('mailtemp.info'),('tmpmail.org'),('tmpmail.net'),('tmpeml.com'),('tempinbox.com'),
  ('dropmail.me'),('33mail.com'),('mytemp.email'),('inboxbear.com'),('vomoto.com'),
  ('fakemail.net'),('emailtemporario.com.br'),('email-temp.com'),('mailpoof.com'),
  ('emlhub.com'),('byom.de'),('inboxkitten.com'),('mailsac.com')
ON CONFLICT (domain) DO NOTHING;

-- 5. Tabela de fingerprints de signup
CREATE TABLE IF NOT EXISTS public.signup_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text,
  ip_address text,
  user_agent text,
  email_normalized text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_fingerprints_fp_idx ON public.signup_fingerprints (fingerprint);
CREATE INDEX IF NOT EXISTS signup_fingerprints_ip_idx ON public.signup_fingerprints (ip_address);
CREATE INDEX IF NOT EXISTS signup_fingerprints_user_idx ON public.signup_fingerprints (user_id);

GRANT SELECT, INSERT ON public.signup_fingerprints TO authenticated;
GRANT ALL ON public.signup_fingerprints TO service_role;

ALTER TABLE public.signup_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own fingerprint"
  ON public.signup_fingerprints FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own fingerprint"
  ON public.signup_fingerprints FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all fingerprints"
  ON public.signup_fingerprints FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete fingerprints"
  ON public.signup_fingerprints FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Função de validação prévia do email (RPC pública)
CREATE OR REPLACE FUNCTION public.validate_signup_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_domain text;
  v_disposable boolean;
  v_exists boolean;
BEGIN
  v_normalized := public.normalize_email(_email);
  IF v_normalized IS NULL OR position('@' in v_normalized) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  v_domain := split_part(v_normalized, '@', 2);
  SELECT EXISTS(SELECT 1 FROM public.disposable_email_domains WHERE domain = v_domain) INTO v_disposable;
  IF v_disposable THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disposable_email');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE email_normalized = v_normalized) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_already_used');
  END IF;

  RETURN jsonb_build_object('ok', true, 'normalized', v_normalized);
END;
$$;

-- 7. Função de checagem de fingerprint duplicado (chamada após signup, identifica suspeitos)
CREATE OR REPLACE FUNCTION public.check_fingerprint_duplicate(_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF _fingerprint IS NULL OR _fingerprint = '' THEN
    RETURN jsonb_build_object('duplicate', false, 'count', 0);
  END IF;
  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM public.signup_fingerprints
  WHERE fingerprint = _fingerprint;
  RETURN jsonb_build_object('duplicate', v_count > 1, 'count', v_count);
END;
$$;

-- 8. View admin: contas suspeitas (fingerprint compartilhado)
CREATE OR REPLACE VIEW public.suspicious_accounts AS
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
