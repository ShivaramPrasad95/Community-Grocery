-- =====================================================================
-- Migration 005: Drop Obsolete DB HTTP Triggers
-- =====================================================================
-- Since Next.js API Routes now handle WhatsApp notifications directly,
-- drop the DB HTTP triggers to prevent pg_net signature errors.
-- =====================================================================

DROP TRIGGER IF EXISTS orders_notify ON public.orders;
DROP TRIGGER IF EXISTS announcements_broadcast ON public.announcements;
