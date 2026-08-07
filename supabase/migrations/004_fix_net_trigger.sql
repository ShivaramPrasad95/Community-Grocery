-- =====================================================================
-- Fix: Schema "net" does not exist error on order placement
-- =====================================================================
-- Run this in Supabase SQL Editor to enable pg_net extension.
-- =====================================================================

-- Option 1: Enable the pg_net extension in Supabase
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Option 2: Alternatively, if pg_net is not enabled, safely drop the old trigger
-- so order inserts succeed without requiring net.http_post:
-- DROP TRIGGER IF EXISTS orders_notify ON public.orders;
