
-- 1) Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_status TEXT NOT NULL DEFAULT 'pendente';

-- Normalize phone: store digits only (helper used by app+functions)
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g')
$$;

-- Unique phone (only when filled)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- 2) OTP table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.otp_codes TO service_role;
-- intencionalmente sem grants para authenticated/anon: tabela só é acessada por edge functions

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp_codes service only" ON public.otp_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS otp_codes_user_id_idx ON public.otp_codes (user_id, created_at DESC);

-- 3) Update handle_new_user to store phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
  initial_status public.user_status;
  raw_phone TEXT;
  norm_phone TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  raw_phone := NEW.raw_user_meta_data ->> 'phone';
  norm_phone := public.normalize_phone(raw_phone);
  IF norm_phone = '' THEN norm_phone := NULL; END IF;

  IF user_count = 0 THEN
    assigned_role := 'admin';
    initial_status := 'ativo';
  ELSE
    assigned_role := 'user';
    initial_status := 'bloqueado';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, status, phone, phone_verified, trial_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    initial_status,
    norm_phone,
    CASE WHEN user_count = 0 THEN TRUE ELSE FALSE END,
    CASE WHEN user_count = 0 THEN 'ativo' ELSE 'pendente' END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Check phone availability (used pre-signup)
CREATE OR REPLACE FUNCTION public.is_phone_available(_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = public.normalize_phone(_phone)
      AND phone IS NOT NULL
      AND phone <> ''
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_available(TEXT) TO anon, authenticated;

-- 5) Mark phone verified + start trial
CREATE OR REPLACE FUNCTION public.mark_phone_verified(_user_id UUID, _phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm TEXT;
BEGIN
  norm := public.normalize_phone(_phone);
  IF norm IS NULL OR norm = '' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  -- Bloqueia se o telefone já pertence a outro usuário
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = norm AND id <> _user_id
  ) THEN
    RAISE EXCEPTION 'phone_in_use';
  END IF;

  UPDATE public.profiles
  SET
    phone = norm,
    phone_verified = TRUE,
    trial_started_at = COALESCE(trial_started_at, now()),
    trial_status = CASE
      WHEN trial_started_at IS NULL THEN 'ativo'
      WHEN now() > trial_started_at + INTERVAL '10 days' THEN 'expirado'
      ELSE 'ativo'
    END,
    status = CASE WHEN status = 'bloqueado' THEN 'ativo'::user_status ELSE status END,
    updated_at = now()
  WHERE id = _user_id;
END;
$$;

-- 6) enforce_trial_status: 10 dias a partir da verificação do telefone
CREATE OR REPLACE FUNCTION public.enforce_trial_status(_user_id UUID)
RETURNS TABLE(status user_status, trial_expired BOOLEAN, trial_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.user_status;
  v_phone_verified BOOLEAN;
  v_trial_started TIMESTAMPTZ;
  v_trial_ends TIMESTAMPTZ;
  v_role public.app_role;
  v_has_paid BOOLEAN;
BEGIN
  SELECT p.status, p.phone_verified, p.trial_started_at
    INTO v_status, v_phone_verified, v_trial_started
  FROM public.profiles p
  WHERE p.id = _user_id;

  -- admin nunca expira
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    INTO v_has_paid;
  IF v_has_paid THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  -- usuário com pagamento ativo não expira pelo trial
  SELECT EXISTS (
    SELECT 1 FROM public.payments
    WHERE user_id = _user_id AND next_due_date >= CURRENT_DATE
  ) INTO v_has_paid;

  IF v_has_paid THEN
    RETURN QUERY SELECT v_status, false, NULL::timestamptz;
    RETURN;
  END IF;

  -- sem telefone verificado: bloqueia (status permanece, mas trial_expired=false)
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
$$;
