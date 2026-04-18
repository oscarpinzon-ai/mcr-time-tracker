# LOVABLE: Fix Job Type Selector Feature

## Problem
Job type selection buttons fail with "Failed to update job type" error.

## Root Cause
The `hcp_jobs_cache` table RLS policy needs to allow public updates to the `job_type` field.

## Solution
Execute this SQL in Supabase **exactly as shown**:

### Step 1: Open Supabase Dashboard
Go to your Supabase project → SQL Editor

### Step 2: Copy and paste this SQL (the entire block):

```sql
ALTER TABLE hcp_jobs_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_public_access" ON hcp_jobs_cache;

CREATE POLICY "allow_all_public_access"
  ON hcp_jobs_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### Step 3: Click "Run" or Execute

### Step 4: Wait for success message

### Step 5: Test in Lovable preview
- Go to technician view
- Click a job type button (SERVICE, YARD, INSTALLATION)
- Should succeed without error

## If it still fails after SQL:
Check the browser console (F12 → Console tab) when clicking a button and report the error message.

## Code changes already deployed:
- `/api/update-job-type` endpoint (with logging)
- Job type buttons in technician view
- Job type editor in admin TimeEntriesTab
