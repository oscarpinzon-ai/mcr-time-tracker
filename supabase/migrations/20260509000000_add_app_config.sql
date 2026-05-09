-- App-level configuration key-value store.
-- Used to hold secrets (like HCP_API_KEY) that need to be readable
-- by server-side code but are not Cloudflare Worker secrets in preview.
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only service-role (server) can read/write — anon clients cannot.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
