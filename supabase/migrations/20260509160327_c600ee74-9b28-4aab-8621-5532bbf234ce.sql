ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS work_order_number text,
  ADD COLUMN IF NOT EXISTS purchase_order_number text,
  ADD COLUMN IF NOT EXISTS job_site_name text;