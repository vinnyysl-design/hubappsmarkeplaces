-- 1) Adiciona coluna 'plano' nos perfis
DO $$ BEGIN
  CREATE TYPE public.user_plan AS ENUM ('trial', 'pagante', 'cortesia');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.user_plan NOT NULL DEFAULT 'trial';

-- 2) Backfill: todos os usuários JÁ EXISTENTES ficam fora do trial.
--    - quem tem pagamento ativo -> 'pagante'
--    - resto -> 'cortesia'
UPDATE public.profiles p
SET plan = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.payments pay
    WHERE pay.user_id = p.id AND pay.next_due_date >= CURRENT_DATE
  ) THEN 'pagante'::public.user_plan
  ELSE 'cortesia'::public.user_plan
END
WHERE p.created_at < now();

-- 3) Novos cadastros entram como 'trial' (default já garante)
--    Atualiza handle_new_user para setar plan='trial' explicitamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  assigned_role public.app_role;
  initial_status public.user_status;
  initial_plan public.user_plan;
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
    initial_plan := 'cortesia';
  ELSE
    assigned_role := 'user';
    initial_status := 'bloqueado';
    initial_plan := 'trial';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, status, phone, phone_verified, trial_status, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    initial_status,
    norm_phone,
    CASE WHEN user_count = 0 THEN TRUE ELSE FALSE END,
    CASE WHEN user_count = 0 THEN 'ativo' ELSE 'pendente' END,
    initial_plan
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;

-- 4) enforce_trial_status: cortesia/pagante nunca expira
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
  v_has_paid BOOLEAN;
  v_plan public.user_plan;
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

  -- cortesia ou pagante: não passa por trial
  IF v_plan IN ('cortesia', 'pagante') THEN
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