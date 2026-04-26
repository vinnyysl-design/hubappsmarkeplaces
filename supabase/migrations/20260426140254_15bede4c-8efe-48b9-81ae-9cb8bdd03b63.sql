CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  paid_at date NOT NULL,
  amount numeric(10,2),
  next_due_date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON public.payments (user_id);
CREATE INDEX idx_payments_next_due_date ON public.payments (next_due_date DESC);
CREATE INDEX idx_payments_paid_at ON public.payments (paid_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para preencher next_due_date automaticamente (paid_at + 30 dias)
-- caso n\u00e3o seja informado, e atualizar updated_at
CREATE OR REPLACE FUNCTION public.payments_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.next_due_date IS NULL THEN
    NEW.next_due_date := NEW.paid_at + INTERVAL '30 days';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_set_defaults
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.payments_set_defaults();