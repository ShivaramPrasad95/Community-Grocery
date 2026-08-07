// Supabase Edge Function: broadcast
// Triggered by pg_net or direct HTTP request on announcement creation.
// Looks up all customers, calls the Node service to fan out WhatsApp messages.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const NODE_SERVICE_URL = Deno.env.get("NODE_SERVICE_URL") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
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

  // Verify env config first
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Function not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  if (!NODE_SERVICE_URL) {
    return json({ error: "Function not configured: missing NODE_SERVICE_URL" }, 500);
  }

  // Catch localhost configuration for Cloud Edge Functions
  if (NODE_SERVICE_URL.includes("localhost") || NODE_SERVICE_URL.includes("127.0.0.1")) {
    return json({
      error: "NODE_SERVICE_URL is set to localhost. Cloud Edge Functions run in Supabase Cloud and require a public URL (e.g. Vercel/Render/Ngrok) to reach your backend server.",
    }, 400);
  }

  // Verify shared secret (but allow OPTIONS preflight)
  const provided = req.headers.get("x-internal-secret");
  if (provided !== INTERNAL_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { announcement_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.announcement_id) {
    return json({ error: "Missing announcement_id" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch announcement
  const { data: announcement, error: aErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", body.announcement_id)
    .maybeSingle();

  if (aErr) {
    return json({ error: `Announcement fetch failed: ${aErr.message}` }, 500);
  }
  if (!announcement) {
    return json({ error: "Announcement not found" }, 404);
  }

  // Fetch all customers
  const { data: customers, error: cErr } = await supabase
    .from("customers")
    .select("id, name, phone");

  if (cErr) {
    return json({ error: `Customers fetch failed: ${cErr.message}` }, 500);
  }

  if (!customers || customers.length === 0) {
    // Mark as sent so UI shows complete, even though there was nobody to send to
    await supabase
      .from("announcements")
      .update({ whatsapp_sent: true })
      .eq("id", announcement.id);
    return json({ ok: true, sent: 0, message: "No customers yet" });
  }

  // Build the message body
  const kindEmoji = announcement.kind === "offer" ? "🏷️" : "🆕";
  const messageBody =
    `${kindEmoji} *${announcement.title}*\n\n` +
    `${announcement.body}\n\n` +
    `— Community Grocery`;

  // Hand off to Node service which knows Twilio creds and handles rate limits.
  try {
    const res = await fetch(`${NODE_SERVICE_URL}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        announcement_id: announcement.id,
        body: messageBody,
        customers: customers.map((c: any) => ({ id: c.id, phone: c.phone })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Node broadcast failed:", errText);
      return json({ error: `Broadcast failed: ${errText}` }, 502);
    }

    const result = await res.json();
    return json(result);
  } catch (err) {
    console.error("Broadcast error:", (err as Error).message);
    return json({ error: `Broadcast error: ${(err as Error).message}` }, 500);
  }
});
