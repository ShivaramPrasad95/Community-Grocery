import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("POSTGRES_URL") || "";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const expectedSecret = Deno.env.get("INTERNAL_SECRET") || "community_secret";
  if (secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // SQL Migration statement to update bulk_upsert_items PL/pgSQL function in PostgreSQL
  const sql = `
    CREATE OR REPLACE FUNCTION public.bulk_upsert_items(rows jsonb)
    RETURNS int
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      inserted_count int := 0;
      r jsonb;
    BEGIN
      FOR r IN SELECT * FROM jsonb_array_elements(rows)
      LOOP
        INSERT INTO public.items (
          name, category, price, unit, stock, barcode, image_url, image_emoji, description, is_new_arrival, is_offer, offer_price
        ) VALUES (
          r->>'name',
          r->>'category',
          (r->>'price')::numeric,
          r->>'unit',
          COALESCE((r->>'stock')::int, 0),
          NULLIF(r->>'barcode', ''),
          NULLIF(r->>'image_url', ''),
          COALESCE(NULLIF(r->>'image_emoji', ''), '📦'),
          NULLIF(r->>'description', ''),
          COALESCE((r->>'is_new_arrival')::boolean, false),
          COALESCE((r->>'is_offer')::boolean, false),
          NULLIF(r->>'offer_price', '')::numeric
        )
        ON CONFLICT (barcode) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          unit = EXCLUDED.unit,
          stock = EXCLUDED.stock,
          image_url = COALESCE(EXCLUDED.image_url, public.items.image_url),
          image_emoji = EXCLUDED.image_emoji,
          description = EXCLUDED.description,
          is_new_arrival = EXCLUDED.is_new_arrival,
          is_offer = EXCLUDED.is_offer,
          offer_price = EXCLUDED.offer_price,
          updated_at = NOW();
        inserted_count := inserted_count + 1;
      END LOOP;
      RETURN inserted_count;
    END;
    $$;

    -- Also add RLS insert/update policies on items table for anon write fallback
    DROP POLICY IF EXISTS items_insert_anon ON public.items;
    CREATE POLICY items_insert_anon ON public.items FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS items_update_anon ON public.items;
    CREATE POLICY items_update_anon ON public.items FOR UPDATE USING (true);
  `;

  try {
    const client = new Client(DB_URL);
    await client.connect();
    await client.queryArray(sql);
    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Migration applied successfully to PostgreSQL DB!" }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
});
