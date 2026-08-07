-- =====================================================================
-- Migration 006: Allow Write Policies & Security Definer Helpers
-- =====================================================================
-- Run this in Supabase SQL Editor to allow admin write operations
-- and enable security definer helpers for announcements & catalog updates.
-- =====================================================================

DROP POLICY IF EXISTS items_all_write ON public.items;
CREATE POLICY items_all_write ON public.items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS announcements_all_write ON public.announcements;
CREATE POLICY announcements_all_write ON public.announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS shop_config_all_write ON public.shop_config;
CREATE POLICY shop_config_all_write ON public.shop_config FOR ALL USING (true) WITH CHECK (true);

-- Security definer RPC for publishing announcements securely
CREATE OR REPLACE FUNCTION public.publish_announcement(title text, body text, kind text, image_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.announcements (title, body, kind, image_url)
  VALUES (title, body, kind, NULLIF(image_url, ''))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
