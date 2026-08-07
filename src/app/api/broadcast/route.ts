import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateInternalRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { announcement_id, body, customers } = await req.json();
    if (!announcement_id || !body || !Array.isArray(customers)) {
      return NextResponse.json({ error: 'announcement_id, body, customers required' }, { status: 400 });
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
    let sent = 0;
    let failed = 0;
    const errors: any[] = [];

    const BATCH_SIZE = 10;
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (c: any) => {
          const phone = String(c.phone || '').replace(/\D/g, '');
          const to = `whatsapp:+${phone.startsWith('91') ? phone : '91' + phone}`;
          const msg = await client.messages.create({ from, to, body });
          return { customer_id: c.id, phone: to, sid: msg.sid };
        })
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const c = batch[j];
        if (r.status === 'fulfilled') {
          sent++;
          await supabase.from('broadcast_log').insert({
            announcement_id,
            customer_id: c.id,
            phone: r.value.phone,
            status: 'sent',
          });
        } else {
          failed++;
          const errMsg = r.reason?.message || 'Unknown error';
          errors.push({ customer_id: c.id, error: errMsg });
          await supabase.from('broadcast_log').insert({
            announcement_id,
            customer_id: c.id,
            phone: c.phone,
            status: 'failed',
            error: errMsg,
          });
        }
      }

      if (i + BATCH_SIZE < customers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    await supabase
      .from('announcements')
      .update({ whatsapp_sent: true })
      .eq('id', announcement_id);

    return NextResponse.json({ ok: true, sent, failed, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
