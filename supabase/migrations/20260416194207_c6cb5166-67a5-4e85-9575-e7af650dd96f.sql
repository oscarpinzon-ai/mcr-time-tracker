-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hcp_employee_id text,
  is_active boolean NOT NULL DEFAULT true,
  role text NOT NULL DEFAULT 'technician',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TIME ENTRIES
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  hcp_job_id text,
  job_number text NOT NULL,
  customer_name text,
  job_type text,
  job_address text,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  status text NOT NULL DEFAULT 'active',
  total_minutes numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_employee_status ON public.time_entries(employee_id, status);
CREATE INDEX idx_time_entries_clock_in ON public.time_entries(clock_in DESC);

-- PAUSE LOGS
CREATE TABLE public.pause_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  pause_start timestamptz NOT NULL,
  pause_end timestamptz
);
CREATE INDEX idx_pause_logs_entry ON public.pause_logs(time_entry_id);

-- ADMIN EDITS LOG
CREATE TABLE public.admin_edits_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  edited_by text NOT NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  edited_at timestamptz NOT NULL DEFAULT now()
);

-- HCP JOBS CACHE
CREATE TABLE public.hcp_jobs_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hcp_job_id text UNIQUE NOT NULL,
  job_number text NOT NULL,
  customer_name text,
  job_type text,
  job_address text,
  status text,
  scheduled_date date,
  assigned_employee_ids text[],
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb
);
CREATE INDEX idx_hcp_jobs_scheduled ON public.hcp_jobs_cache(scheduled_date);

-- ENABLE RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pause_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_edits_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcp_jobs_cache ENABLE ROW LEVEL SECURITY;

-- POLICIES (Phase 1: open access)
CREATE POLICY "Allow all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.pause_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.admin_edits_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.hcp_jobs_cache FOR ALL USING (true) WITH CHECK (true);