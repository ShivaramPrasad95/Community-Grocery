// Supabase Edge Function: fetch-off-image
// Looks up an EAN/UPC barcode in Open Food Facts, caches the image URL.
// Called by the bulk-upload UI per row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Verify env config
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Function not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  let body: { barcode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.barcode || !/^\d{8,14}$/.test(body.barcode)) {
    return json({ error: "Invalid or missing barcode (must be 8-14 digits)" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const barcode = body.barcode;

  // 1. Check cache first
  try {
    const { data: cached } = await supabase
      .from("image_cache")
      .select("image_url, product_name")
      .eq("barcode", barcode)
      .maybeSingle();

    if (cached) {
      return json({
        found: !!cached.image_url,
        image_url: cached.image_url,
        product_name: cached.product_name,
        cached: true,
      });
    }
  } catch (err) {
    console.warn("Cache read failed:", (err as Error).message);
    // Continue to OFF lookup even if cache fails
  }

  // 2. Fetch from Open Food Facts
  let imageUrl: string | null = null;
  let productName: string | null = null;
  try {
    const res = await fetch(`${OFF_BASE}/${barcode}.json`, {
      headers: { "User-Agent": "CommunityGrocery/1.0 (contact@example.com)" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product) {
        productName = data.product.product_name || data.product.generic_name || null;
        imageUrl = data.product.image_front_url || data.product.image_url || null;
      }
    } else {
      console.warn(`OFF returned ${res.status} for ${barcode}`);
    }
  } catch (err) {
    console.warn("OFF fetch failed:", (err as Error).message);
    // Fall through — we'll still cache the miss
  }

  // 3. Cache the result (even nulls, so we don't hammer OFF for missing barcodes)
  try {
    await supabase.from("image_cache").upsert({
      barcode,
      image_url: imageUrl,
      product_name: productName,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Cache write failed:", (err as Error).message);
    // Non-fatal — still return the result
  }

  return json({
    found: !!imageUrl,
    image_url: imageUrl,
    product_name: productName,
    cached: false,
  });
});
