DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='allow_select'
  ) THEN
    CREATE POLICY "allow_select" ON public.app_config FOR SELECT USING (true);
  END IF;
END $$;