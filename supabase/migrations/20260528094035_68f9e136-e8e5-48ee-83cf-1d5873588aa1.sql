
CREATE OR REPLACE FUNCTION public.prevent_non_admin_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite alterações quando não há usuário autenticado (service role / backend / webhook)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user status';
  END IF;
  RETURN NEW;
END;
$function$;

-- Libera o usuário cujo pagamento já foi aprovado mas ficou preso
UPDATE public.profiles
SET status = 'ativo'
WHERE id = 'c071f67f-b650-4039-a2dc-8d8ba7723bfa';
