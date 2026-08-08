-- =====================================================================
-- Community Grocery — Initial Schema
-- =====================================================================
-- Run this once in Supabase SQL Editor (or via `supabase db push`).
-- All tables live in the `public` schema with RLS enabled.
-- The anon key gets read access; the service role key (server-side only)
-- gets full write access. Customer order placement uses the anon key
-- through RLS policies that allow INSERT on orders + customers.
-- =====================================================================

-- ---------- Items ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(10, 2) not null check (price >= 0),
  unit text not null,
  stock int not null default 0 check (stock >= 0),
  barcode text unique,
  image_url text,
  image_emoji text default '📦',
  description text,
  is_new_arrival boolean default false,
  is_offer boolean default false,
  offer_price numeric(10, 2) check (offer_price is null or offer_price >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists items_category_idx on public.items (category);
create index if not exists items_barcode_idx on public.items (barcode);
create index if not exists items_new_arrival_idx on public.items (is_new_arrival) where is_new_arrival = true;
create index if not exists items_offer_idx on public.items (is_offer) where is_offer = true;

-- ---------- Customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  flat text,
  default_notes text,
  default_delivery_time text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists customers_phone_idx on public.customers (phone);

-- ---------- Orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','confirmed','delivered','cancelled')),
  items jsonb not null,
  subtotal numeric(10, 2) not null,
  delivery_charge numeric(10, 2) default 0,
  total numeric(10, 2) not null,
  delivery_time text,
  notes text,
  whatsapp_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_customer_idx on public.orders (customer_id);

-- ---------- Announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null check (kind in ('new_arrival','offer')),
  image_url text,
  whatsapp_sent boolean default false,
  created_at timestamptz default now()
);

-- ---------- Broadcast log ----------
create table if not exists public.broadcast_log (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  phone text,
  status text check (status in ('sent','failed','skipped')),
  error text,
  created_at timestamptz default now()
);

-- ---------- Shop config (single row) ----------
create table if not exists public.shop_config (
  id int primary key default 1,
  shop_name text default 'Community Grocery',
  currency text default '₹',
  delivery_charge numeric(10, 2) default 0,
  minimum_order numeric(10, 2) default 0,
  admin_password_hash text,
  twilio_from_number text,
  updated_at timestamptz default now(),
  constraint shop_config_single_row check (id = 1)
);

-- Seed config row
insert into public.shop_config (id) values (1) on conflict (id) do nothing;

-- ---------- Image cache ----------
create table if not exists public.image_cache (
  barcode text primary key,
  image_url text,
  product_name text,
  fetched_at timestamptz default now()
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- Public read of items (anon key).
-- Anon can insert customers and orders (the customer is placing an order).
-- Everything else (item writes, status updates, announcements) requires
-- the service role key — used only by the Node server / Edge Functions.
-- =====================================================================

alter table public.items enable row level security;
drop policy if exists items_read_all on public.items;
create policy items_read_all on public.items for select using (true);

alter table public.customers enable row level security;
drop policy if exists customers_read_all on public.customers;
create policy customers_read_all on public.customers for select using (true);
drop policy if exists customers_insert_anon on public.customers;
create policy customers_insert_anon on public.customers for insert with check (true);
drop policy if exists customers_update_anon on public.customers;
create policy customers_update_anon on public.customers for update using (true);

alter table public.orders enable row level security;
drop policy if exists orders_read_all on public.orders;
create policy orders_read_all on public.orders for select using (true);
drop policy if exists orders_insert_anon on public.orders;
create policy orders_insert_anon on public.orders for insert with check (true);
drop policy if exists orders_update_anon on public.orders;
create policy orders_update_anon on public.orders for update using (true);

alter table public.announcements enable row level security;
drop policy if exists announcements_read_all on public.announcements;
create policy announcements_read_all on public.announcements for select using (true);

alter table public.image_cache enable row level security;
drop policy if exists image_cache_read_all on public.image_cache;
create policy image_cache_read_all on public.image_cache for select using (true);

alter table public.shop_config enable row level security;
drop policy if exists shop_config_read_public on public.shop_config;
create policy shop_config_read_public on public.shop_config for select using (true);

-- broadcast_log is server-only; no anon policies.

-- =====================================================================
-- Atomic stock decrement RPC
-- =====================================================================
-- Called by the customer app during order placement. Takes a JSONB array
-- of {id, qty} and decrements each item's stock in a single transaction,
-- preventing oversell under concurrency.
-- =====================================================================

create or replace function public.decrement_stock(items jsonb)
returns void
language plpgsql
security definer
as $$
declare
  it jsonb;
begin
  for it in select * from jsonb_array_elements(items)
  loop
    update public.items
       set stock = greatest(0, stock - (it->>'qty')::int),
           updated_at = now()
     where id = (it->>'id')::uuid;
  end loop;
end;
$$;

-- =====================================================================
-- Bulk upsert RPC
-- =====================================================================
-- Called by the bulk-upload UI. Each row is upserted by barcode (so a
-- re-upload can update price/stock without duplicating).
-- =====================================================================

create or replace function public.bulk_upsert_items(rows jsonb)
returns int
language plpgsql
security definer
as $$
declare
  inserted_count int := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(rows)
  loop
    insert into public.items (
      name, category, price, unit, stock, barcode, image_url, image_emoji, description, is_new_arrival, is_offer, offer_price
    ) values (
      r->>'name',
      r->>'category',
      (r->>'price')::numeric,
      r->>'unit',
      coalesce((r->>'stock')::int, 0),
      nullif(r->>'barcode', ''),
      nullif(r->>'image_url', ''),
      coalesce(nullif(r->>'image_emoji', ''), '📦'),
      nullif(r->>'description', ''),
      coalesce((r->>'is_new_arrival')::boolean, false),
      coalesce((r->>'is_offer')::boolean, false),
      nullif(r->>'offer_price', '')::numeric
    )
    on conflict (barcode) do update set
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      unit = excluded.unit,
      stock = excluded.stock,
      image_url = coalesce(excluded.image_url, public.items.image_url),
      image_emoji = excluded.image_emoji,
      description = excluded.description,
      is_new_arrival = excluded.is_new_arrival,
      is_offer = excluded.is_offer,
      offer_price = excluded.offer_price,
      updated_at = now();
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;

-- =====================================================================
-- updated_at trigger
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
