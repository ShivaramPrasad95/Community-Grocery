import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateAdminRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { item_id, delta } = await req.json();
    if (!item_id || typeof delta !== 'number') {
      return NextResponse.json({ error: 'item_id and delta required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (delta < 0) {
      const { error } = await supabase.rpc('decrement_stock', {
        items: [{ id: item_id, qty: Math.abs(delta) }],
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.rpc('decrement_stock', {
        items: [{ id: item_id, qty: -delta }],
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
