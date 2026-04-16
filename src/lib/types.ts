export type Employee = {
  id: string;
  name: string;
  hcp_employee_id: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  employee_id: string;
  hcp_job_id: string | null;
  job_number: string;
  customer_name: string | null;
  job_type: string | null;
  job_address: string | null;
  clock_in: string;
  clock_out: string | null;
  status: "active" | "paused" | "completed";
  total_minutes: number | null;
  created_at: string;
};

export type PauseLog = {
  id: string;
  time_entry_id: string;
  pause_start: string;
  pause_end: string | null;
};

export type HcpJob = {
  id: string;
  hcp_job_id: string;
  job_number: string;
  customer_name: string | null;
  job_type: string | null;
  job_address: string | null;
  status: string | null;
  scheduled_date: string | null;
  assigned_employee_ids: string[] | null;
  last_synced_at: string;
  raw_data: unknown;
};

export type AdminEditLog = {
  id: string;
  time_entry_id: string;
  edited_by: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  edited_at: string;
};

export const JOB_TYPES = [
  "Service Call / Repair",
  "Yard Work",
  "Installation / Removal",
] as const;
