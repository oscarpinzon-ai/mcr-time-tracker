-- app_config RLS had no SELECT policy, blocking reads via anon key in Lovable preview.
-- Server functions in Lovable only have the publishable key, not the service role key,
-- so RLS was silently returning empty results for the hcp_api_key lookup.
CREATE POLICY "allow_select" ON public.app_config
  FOR SELECT USING (true);
