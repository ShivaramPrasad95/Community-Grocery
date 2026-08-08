// Supabase Edge Function: notify-telegram
// Triggered on new order creation to send structured order alerts to Telegram Bot.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return json({
      ok: false,
      message: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in Supabase Secrets",
    }, 200);
  }

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.order_id) {
    return json({ error: "Missing order_id" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase credentials missing" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch order and customer details
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("*, customers(name, phone, flat)")
    .eq("id", body.order_id)
    .maybeSingle();

  if (oErr || !order) {
    return json({ error: `Order not found: ${oErr?.message || 'invalid id'}` }, 404);
  }

  const customer = order.customers || {};
  const items = Array.isArray(order.items) ? order.items : [];

  const itemsText = items
    .map((it: any) => `• *${it.name || 'Item'}* × ${it.qty || 1} — ₹${(it.price || 0) * (it.qty || 1)}`)
    .join('\n');

  const messageText =
    `🛒 *NEW GROCERY ORDER!*\n\n` +
    `🆔 *Order ID:* \`#${order.id.slice(0, 8)}\`\n` +
    `👤 *Customer:* ${customer.name || 'N/A'}\n` +
    `📞 *Phone:* ${customer.phone || 'N/A'}\n` +
    `🏠 *Flat/Address:* ${customer.flat || 'N/A'}\n` +
    `⏰ *Delivery Slot:* ${order.delivery_time || 'Asap'}\n` +
    `💰 *Total Amount:* ₹${order.total}\n\n` +
    `📦 *Ordered Items:*\n${itemsText || 'None'}\n\n` +
    `🌐 [View Admin Dashboard](https://community-grocery.vercel.app/admin)`;

  try {
    const teleRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: "Markdown",
      }),
    });

    const teleData = await teleRes.json();

    if (!teleRes.ok || !teleData.ok) {
      if (teleData.error_code === 403 && teleData.description?.includes("can't send messages to the bot")) {
        return json({
          ok: false,
          error: "TELEGRAM_CHAT_ID is set to the Bot's ID instead of your Personal User Chat ID. Send a message to @userinfobot on Telegram to get your 9-digit Personal Chat ID.",
          teleData,
        }, 400);
      }
      return json({ ok: false, error: teleData.description || "Telegram API error", teleData }, 400);
    }

    return json({ ok: true, teleData });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
