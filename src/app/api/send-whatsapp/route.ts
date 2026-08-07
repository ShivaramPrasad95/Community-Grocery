import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateInternalRequest } from '@/lib/auth';

import { formatWhatsAppNumber } from '@/lib/phone';

export async function POST(req: NextRequest) {
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to: rawTo, body, kind, order_id } = await req.json();
    if (!rawTo || !body) {
      return NextResponse.json({ error: 'to and body required' }, { status: 400 });
    }

    const to = formatWhatsAppNumber(rawTo);
    if (!to) {
      return NextResponse.json({ error: 'Invalid destination phone number' }, { status: 400 });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
      return NextResponse.json({ error: 'Twilio credentials missing' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    const { data: cfg } = await supabase
      .from('shop_config')
      .select('twilio_from_number')
      .eq('id', 1)
      .single();

    const from = cfg?.twilio_from_number || process.env.TWILIO_FROM_NUMBER;
    if (!from) {
      return NextResponse.json({ error: 'Twilio from-number not configured' }, { status: 500 });
    }

    const client = twilio(sid, token);
    const message = await client.messages.create({ from, to, body });

    if (kind === 'order' && order_id) {
      await supabase.from('orders').update({ whatsapp_sent: true }).eq('id', order_id);
    }

    return NextResponse.json({ ok: true, sid: message.sid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
