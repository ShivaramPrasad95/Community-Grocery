-- =====================================================================
-- Migration 007: Enable pg_net Triggers for Supabase Edge Functions
-- =====================================================================
-- Run this in Supabase Dashboard → SQL Editor to enable DB-level HTTP triggers.
-- Whenever a row is inserted into orders or announcements, pg_net fires
-- an HTTP POST to notify-order or broadcast Edge Functions automatically.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Order Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_order_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url text := 'https://torwhncifecugoxydwmh.supabase.co';
  fn_secret text := '<YOUR_INTERNAL_SECRET>';
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'order_id', new.id,
    'customer_id', new.customer_id,
    'total', new.total,
    'flat', (select flat from public.customers where id = new.customer_id),
    'phone', (select phone from public.customers where id = new.customer_id),
    'items_count', jsonb_array_length(new.items)
  );

  PERFORM net.http_post(
    url := edge_url || '/functions/v1/notify-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', fn_secret
    ),
    body := payload::text
  );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify ON public.orders;
CREATE TRIGGER orders_notify
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_trigger();

-- 2. Broadcast Announcement Trigger
CREATE OR REPLACE FUNCTION public.broadcast_announcement_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url text := 'https://torwhncifecugoxydwmh.supabase.co';
  fn_secret text := '<YOUR_INTERNAL_SECRET>';
BEGIN
  PERFORM net.http_post(
    url := edge_url || '/functions/v1/broadcast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', fn_secret
    ),
    body := jsonb_build_object('announcement_id', new.id)::text
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS announcements_broadcast ON public.announcements;
CREATE TRIGGER announcements_broadcast
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_announcement_trigger();
