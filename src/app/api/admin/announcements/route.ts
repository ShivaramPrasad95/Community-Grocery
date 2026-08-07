import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateAdminRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, body, kind, image_url } = await req.json();
    if (!title || !body || !kind) {
      return NextResponse.json({ error: 'title, body, kind required' }, { status: 400 });
    }
    if (!['new_arrival', 'offer'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be new_arrival or offer' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .insert({ title, body, kind, image_url: image_url || null })
      .select('id')
      .single();

    let annId = data?.id;

    if (error) {
      // Fallback via RPC if RLS blocks direct insert
      const { data: rpcId, error: rpcErr } = await supabase.rpc('publish_announcement', {
        title,
        body,
        kind,
        image_url: image_url || null,
      });

      if (rpcErr) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      annId = rpcId;
    }

    // Trigger server-side broadcast fan-out using process.env.INTERNAL_SECRET
    if (annId) {
      try {
        const { data: customers } = await supabase.from('customers').select('id, name, phone');
        if (customers && customers.length > 0) {
          const kindEmoji = kind === 'offer' ? '🏷️' : '🆕';
          const msgBody = `${kindEmoji} *${title}*\n\n${body}\n\n— Community Grocery`;
          const internalSecret = process.env.INTERNAL_SECRET || '';
          const host = req.headers.get('host') || 'community-grocery.vercel.app';
          const protocol = host.includes('localhost') ? 'http' : 'https';

          fetch(`${protocol}://${host}/api/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': internalSecret,
            },
            body: JSON.stringify({
              announcement_id: annId,
              body: msgBody,
              customers,
            }),
          }).catch((bcErr) => console.error('Server broadcast dispatch error:', bcErr));
        }
      } catch (custErr) {
        console.error('Customer fetch for broadcast failed:', custErr);
      }
    }

    return NextResponse.json({ ok: true, id: annId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
