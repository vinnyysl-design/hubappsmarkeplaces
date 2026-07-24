ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_preapproval_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_mp_preapproval_id ON public.profiles(mp_preapproval_id);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_authorized_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_authorized_payment_id
  ON public.payments(mp_authorized_payment_id)
  WHERE mp_authorized_payment_id IS NOT NULL;