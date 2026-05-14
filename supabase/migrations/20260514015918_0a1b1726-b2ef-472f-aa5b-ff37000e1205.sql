-- 1) Atualiza a função handle_new_user para criar perfis com status 'bloqueado'
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
BEGIN
  -- Conta quantos roles já existem para definir se este é o primeiro usuário (admin)
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  IF user_count = 0 THEN
    assigned_role := 'admin';
    initial_status := 'ativo'; -- primeiro usuário (admin) já entra ativo
  ELSE
    assigned_role := 'user';
    initial_status := 'bloqueado'; -- demais cadastros começam bloqueados
  END IF;

  INSERT INTO public.profiles (id, email, display_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    initial_status
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$function$;

-- 2) Simplifica enforce_trial_status para virar um no-op (mantida por compatibilidade)
CREATE OR REPLACE FUNCTION public.enforce_trial_status(_user_id uuid)
RETURNS TABLE(status user_status, trial_expired boolean, trial_ends_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status user_status;
BEGIN
  SELECT p.status INTO v_status FROM public.profiles p WHERE p.id = _user_id;
  RETURN QUERY SELECT v_status, false, NULL::timestamptz;
END;
$function$;