-- =====================================================================
-- Triggers: notify-order + broadcast
-- =====================================================================
-- We use pg_net (Supabase's async HTTP client) so the Edge Function call
-- doesn't block the INSERT. The Edge Function then calls our Node server
-- which uses Twilio to actually send the WhatsApp message.
--
-- pg_net is part of Supabase by default; no extension install needed.
-- =====================================================================

-- ---------- On new order: send WhatsApp confirmation ----------
create or replace function public.notify_order_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.edge_function_url', true);
  fn_secret text := current_setting('app.edge_function_secret', true);
  payload jsonb;
begin
  payload := jsonb_build_object(
    'order_id', new.id,
    'customer_id', new.customer_id,
    'total', new.total,
    'flat', (select flat from public.customers where id = new.customer_id),
    'phone', (select phone from public.customers where id = new.customer_id),
    'items_count', jsonb_array_length(new.items)
  );

  -- Fire and forget; don't block the INSERT.
  perform net.http_post(
    url := edge_url || '/functions/v1/notify-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || fn_secret,
      'x-internal-secret', fn_secret
    ),
    body := payload::text
  );

  return new;
end;
$$;

drop trigger if exists orders_notify on public.orders;
create trigger orders_notify
  after insert on public.orders
  for each row execute function public.notify_order_trigger();

-- ---------- On new announcement: broadcast to all customers ----------
create or replace function public.broadcast_announcement_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.edge_function_url', true);
  fn_secret text := current_setting('app.edge_function_secret', true);
begin
  perform net.http_post(
    url := edge_url || '/functions/v1/broadcast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', fn_secret
    ),
    body := jsonb_build_object('announcement_id', new.id)::text
  );
  return new;
end;
$$;

drop trigger if exists announcements_broadcast on public.announcements;
create trigger announcements_broadcast
  after insert on public.announcements
  for each row execute function public.broadcast_announcement_trigger();
