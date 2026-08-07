# Supabase Edge Functions — Deployment Guide

This directory contains 3 Edge Functions:
- `fetch-off-image/` — barcode → Open Food Facts image lookup (called by bulk-upload UI)
- `broadcast/` — announcement → fan-out WhatsApp broadcast (called by DB trigger on announcements insert)
- `notify-order/` — new order → WhatsApp confirmation (called by DB trigger on orders insert)

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # npm (any OS)
   npm install -g supabase
   
   # Or download: https://github.com/supabase/cli/releases
   ```

2. **Supabase project access** — your project is already at:
   ```
   https://torwhncifecugoxydwmh.supabase.co
   ```

## Step 1: Login to Supabase

```bash
supabase login
```

A browser window opens. Sign in with the same account that owns this project.

## Step 2: Link to the project

```bash
supabase link --project-ref torwhncifecugoxydwmh
```

When prompted, enter your **database password** (you set this when creating the project).

## Step 3: Set Function Secrets

Each function needs environment variables. Set them in the Supabase Dashboard:
**Project Settings → Edge Functions → Secrets**

Add these secrets (use values from `server/.env`):

| Secret | Value | Used by |
|--------|-------|---------|
| `SUPABASE_URL` | `https://torwhncifecugoxydwmh.supabase.co` | all 3 functions |
| `SUPABASE_SERVICE_ROLE_KEY` | (your service_role key) | `fetch-off-image`, `broadcast` |
| `NODE_SERVICE_URL` | Your deployed Node server URL (e.g. `https://your-app.onrender.com`) | `broadcast`, `notify-order` |
| `INTERNAL_SECRET` | Same value as `INTERNAL_SECRET` in `server/.env` | `broadcast`, `notify-order` |

> ⚠️ `NODE_SERVICE_URL` must be **publicly reachable** (not `http://localhost:3000`) — Edge Functions run in the cloud.

### Or via CLI:

```bash
supabase secrets set SUPABASE_URL=https://torwhncifecugoxydwmh.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
supabase secrets set NODE_SERVICE_URL=https://your-node-service.onrender.com
supabase secrets set INTERNAL_SECRET=<YOUR_INTERNAL_SECRET>
```

## Step 4: Deploy each function

```bash
supabase functions deploy fetch-off-image
supabase functions deploy broadcast
supabase functions deploy notify-order
```

You should see a success URL like:
```
https://torwhncifecugoxydwmh.supabase.co/functions/v1/fetch-off-image
```

## Step 5: Set the Postgres Variables

The DB triggers (`002_triggers.sql`) read two Postgres-level variables at runtime:

```sql
ALTER DATABASE postgres SET app.edge_function_url = 'https://torwhncifecugoxydwmh.supabase.co';
ALTER DATABASE postgres SET app.edge_function_secret = '<YOUR_INTERNAL_SECRET>';
```

Run this in **Supabase Dashboard → SQL Editor**, then restart the database
(**Settings → Database → Restart**).

The values must match the `INTERNAL_SECRET` secret you set in Step 3.

## Step 6: Verify

Test each function with curl:

```bash
# fetch-off-image (public, just needs barcode)
curl -X POST https://torwhncifecugoxydwmh.supabase.co/functions/v1/fetch-off-image \
  -H "Content-Type: application/json" \
  -d '{"barcode":"8901030865278"}'

# broadcast (internal — needs x-internal-secret)
curl -X POST https://torwhncifecugoxydwmh.supabase.co/functions/v1/broadcast \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <YOUR_INTERNAL_SECRET>" \
  -d '{"announcement_id":"some-uuid"}'
```

## Function Reference

### POST /functions/v1/fetch-off-image
- **Body**: `{"barcode": "8901030865278"}`
- **Returns**: `{"found": bool, "image_url": string|null, "product_name": string|null, "cached": bool}`
- **Errors**: `400` invalid barcode, `500` missing env config

### POST /functions/v1/broadcast
- **Body**: `{"announcement_id": "uuid"}`
- **Auth**: `x-internal-secret` header (must match function secret)
- **Returns**: `{"ok": true, "sent": number, "failed": number}`
- **Errors**: `401` bad secret, `404` announcement not found, `502` Node service failed

### POST /functions/v1/notify-order
- **Body**: `{"order_id": "uuid", "customer_id": "uuid", "total": number, "phone": "...", "flat": "...", "items_count": number}`
- **Auth**: `x-internal-secret` header
- **Returns**: `{"ok": true, "to": "whatsapp:+91..."}`
- **Errors**: `401` bad secret, `502` Node service failed