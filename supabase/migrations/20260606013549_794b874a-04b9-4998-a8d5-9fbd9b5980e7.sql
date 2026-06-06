
-- Ativa trial quando o email é confirmado (substitui mark_phone_verified)
CREATE OR REPLACE FUNCTION public.activate_trial_after_email_confirm(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- só o próprio usuário pode ativar o trial dele
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.profiles
  SET
    phone_verified = TRUE,  -- reusa o flag para destravar acesso aos apps
    trial_started_at = COALESCE(trial_started_at, now()),
    trial_status = CASE
      WHEN trial_started_at IS NULL THEN 'ativo'
      WHEN now() > trial_started_at + INTERVAL '10 days' THEN 'expirado'
      ELSE 'ativo'
    END,
    status = CASE WHEN status = 'bloqueado' THEN 'ativo'::user_status ELSE status END,
    updated_at = now()
  WHERE id = _user_id
    AND EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL);
END;
$$;
