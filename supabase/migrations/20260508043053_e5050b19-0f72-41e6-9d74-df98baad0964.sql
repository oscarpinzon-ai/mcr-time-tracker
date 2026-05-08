DROP INDEX IF EXISTS public.work_orders_hcp_id_key;
DELETE FROM public.work_orders a USING public.work_orders b
  WHERE a.ctid < b.ctid AND a.hcp_id = b.hcp_id AND a.hcp_id IS NOT NULL;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_hcp_id_key UNIQUE (hcp_id);