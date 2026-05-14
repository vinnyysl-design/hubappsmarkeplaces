
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- Permitir o próprio usuário gravar o aceite (a policy existente "Users can update own profile (no status)"
-- já permite update; mantemos como está, pois não altera status)
