#!/usr/bin/env bash
# =====================================================================
# Deploy all Supabase Edge Functions
# =====================================================================
# Prereqs:
#   1. Supabase CLI installed (brew install supabase/tap/supabase)
#   2. Run `supabase login` once to authenticate
#   3. Run `supabase link --project-ref torwhncifecugoxydwmh` once
#   4. Secrets configured (see supabase/functions/README.md)
# =====================================================================

set -e

PROJECT_REF="torwhncifecugoxydwmh"

echo "==> Deploying Edge Functions to project $PROJECT_REF"
echo ""

for fn in fetch-off-image broadcast notify-order; do
  echo "==> Deploying $fn..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo "    ✅ $fn deployed"
  echo ""
done

echo "==> All functions deployed!"
echo ""
echo "Test URLs:"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/fetch-off-image"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/broadcast"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/notify-order"