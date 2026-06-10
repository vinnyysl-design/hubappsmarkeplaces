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
    -- libera trial imediatamente no cadastro (10 dias)
    initial_status := 'ativo';
    initial_plan := 'trial';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, status, phone, phone_verified, trial_status, trial_started_at, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    initial_status,
    norm_phone,
    TRUE,  -- destrava acesso aos apps imediatamente
    'ativo',
    now(),
    initial_plan
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;

-- Corrige usuários já existentes que ficaram bloqueados como trial pendente
UPDATE public.profiles
SET status = 'ativo'::public.user_status,
    phone_verified = TRUE,
    trial_status = 'ativo',
    trial_started_at = COALESCE(trial_started_at, now()),
    updated_at = now()
WHERE plan = 'trial'
  AND status = 'bloqueado'::public.user_status
  AND trial_status = 'pendente';
