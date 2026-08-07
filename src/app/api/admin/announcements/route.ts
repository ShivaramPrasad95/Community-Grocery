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

      return NextResponse.json({ ok: true, id: rpcId });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
