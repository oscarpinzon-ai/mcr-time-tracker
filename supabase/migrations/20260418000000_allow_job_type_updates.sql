-- Allow updates to job_type field on hcp_jobs_cache for all users
-- This enables technicians to select job types from the mobile app

ALTER TABLE hcp_jobs_cache ENABLE ROW LEVEL SECURITY;

-- Drop old policy if it exists
DROP POLICY IF EXISTS "allow_all_public_access" ON hcp_jobs_cache;

-- Create new policy that allows full access (matches original "Allow all" behavior)
CREATE POLICY "allow_all_public_access"
  ON hcp_jobs_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
