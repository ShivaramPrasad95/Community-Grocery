import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Return ok if Telegram bot is not configured yet, so order flow never breaks
      return NextResponse.json({ ok: true, skipped: true, message: 'Telegram Bot credentials not set in environment' });
    }

    const supabase = getSupabaseAdmin();

    // Fetch order details & customer info
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(name, phone, flat)')
      .eq('id', order_id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
      `⏰ *Delivery Slot:* ${order.delivery_slot || 'Asap'}\n` +
      `💰 *Total Amount:* ₹${order.total}\n\n` +
      `📦 *Ordered Items:*\n${itemsText || 'None'}\n\n` +
      `🌐 [View Admin Dashboard](https://community-grocery.vercel.app/admin)`;

    const teleRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
      }),
    });

    const teleData = await teleRes.json();
    return NextResponse.json({ ok: teleRes.ok, teleData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
