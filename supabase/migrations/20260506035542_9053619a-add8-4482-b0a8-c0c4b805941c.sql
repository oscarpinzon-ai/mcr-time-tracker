
-- Drop old tables
DROP TABLE IF EXISTS public.admin_edits_log CASCADE;
DROP TABLE IF EXISTS public.pause_logs CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.hcp_jobs_cache CASCADE;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- work_orders
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hcp_id text,
  hcp_type text NOT NULL CHECK (hcp_type IN ('job','estimate')),
  number text NOT NULL,
  customer_name text,
  address text,
  description text,
  hcp_status text,
  scheduled_date date,
  assigned_to text,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hcp_type, number)
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.work_orders FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- parts
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  part_number text,
  quantity numeric NOT NULL DEFAULT 1,
  vendor text,
  unit_price numeric,
  total_price numeric,
  pricing_status text NOT NULL DEFAULT 'pending' CHECK (pricing_status IN ('pending','quoted','confirmed')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested','sent_to_parts','pricing','quoted','approved',
    'ordered','shipped','received','installed','cancelled','backordered'
  )),
  tracking_number text,
  tracking_carrier text,
  eta date,
  requested_by text,
  ordered_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.parts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_parts_work_order ON public.parts(work_order_id);
CREATE TRIGGER trg_parts_updated BEFORE UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- part_events
CREATE TABLE public.part_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  author text,
  department text NOT NULL DEFAULT 'other' CHECK (department IN ('dispatch','parts','system','other')),
  event_type text NOT NULL CHECK (event_type IN ('created','status_change','pricing_update','tracking_added','note','field_update')),
  from_status text,
  to_status text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.part_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.part_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_part_events_part ON public.part_events(part_id, created_at DESC);

-- Auto-event trigger on parts changes
CREATE OR REPLACE FUNCTION public.log_part_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.part_events(part_id, author, department, event_type, to_status, message)
    VALUES (NEW.id, NEW.requested_by, 'system', 'created', NEW.status, 'Part created: ' || NEW.name);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.part_events(part_id, department, event_type, from_status, to_status)
    VALUES (NEW.id, 'system', 'status_change', OLD.status, NEW.status);
  END IF;

  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price
     OR NEW.vendor IS DISTINCT FROM OLD.vendor
     OR NEW.part_number IS DISTINCT FROM OLD.part_number
     OR NEW.pricing_status IS DISTINCT FROM OLD.pricing_status THEN
    INSERT INTO public.part_events(part_id, department, event_type, message)
    VALUES (NEW.id, 'system', 'pricing_update',
      'Pricing updated: vendor=' || COALESCE(NEW.vendor,'-') ||
      ', part#=' || COALESCE(NEW.part_number,'-') ||
      ', unit=' || COALESCE(NEW.unit_price::text,'-') ||
      ' (' || NEW.pricing_status || ')');
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
     OR NEW.tracking_carrier IS DISTINCT FROM OLD.tracking_carrier THEN
    INSERT INTO public.part_events(part_id, department, event_type, message)
    VALUES (NEW.id, 'system', 'tracking_added',
      COALESCE(NEW.tracking_carrier,'') || ' ' || COALESCE(NEW.tracking_number,''));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_parts_log_insert AFTER INSERT ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.log_part_change();
CREATE TRIGGER trg_parts_log_update AFTER UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.log_part_change();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.parts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.part_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
