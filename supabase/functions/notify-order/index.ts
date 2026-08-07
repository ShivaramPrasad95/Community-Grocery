// Supabase Edge Function: notify-order
// Triggered by pg_net on every new order insert.
// Sends a WhatsApp confirmation via the Node service.

const NODE_SERVICE_URL = Deno.env.get("NODE_SERVICE_URL") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

interface OrderPayload {
  order_id: string;
  customer_id: string;
  total: number;
  flat?: string;
  phone?: string;
  items_count: number;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify env config
  if (!NODE_SERVICE_URL) {
    return json({ error: "Function not configured: missing NODE_SERVICE_URL" }, 500);
  }

  // Verify shared secret
  const provided = req.headers.get("x-internal-secret");
  if (provided !== INTERNAL_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: OrderPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.phone || !payload.order_id) {
    return json({ error: "Missing phone or order_id" }, 400);
  }

  // Format E.164 (India assumed if 10 digits without country code)
  const phone = payload.phone.startsWith("+")
    ? payload.phone.replace(/\D/g, "")
    : `91${payload.phone.replace(/\D/g, "")}`;
  const to = `whatsapp:+${phone}`;

  const orderShort = payload.order_id.slice(-6).toUpperCase();
  const body =
    `✅ Order #${orderShort} confirmed!\n` +
    `Items: ${payload.items_count} | Total: ₹${Number(payload.total).toFixed(0)}\n` +
    `We'll call you shortly to confirm delivery${payload.flat ? ` to ${payload.flat}` : ""}.\n\n` +
    `— Community Grocery`;

  try {
    const res = await fetch(`${NODE_SERVICE_URL}/api/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ to, body, kind: "order", order_id: payload.order_id }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Node service error:", errText);
      return json({ error: `Node service failed: ${errText}` }, 502);
    }

    return json({ ok: true, to });
  } catch (err) {
    console.error("Error calling Node service:", (err as Error).message);
    return json({ error: `Error: ${(err as Error).message}` }, 500);
  }
});