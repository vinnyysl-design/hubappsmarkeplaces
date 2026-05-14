
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_mp_payment_id_key
  ON public.payments (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

CREATE POLICY "Users can view their own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
