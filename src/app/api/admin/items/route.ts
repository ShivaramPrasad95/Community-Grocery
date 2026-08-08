import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      category,
      price,
      unit,
      stock,
      barcode,
      image_url,
      image_emoji,
      description,
      is_new_arrival,
      is_offer,
      offer_price,
    } = body || {};

    if (!name || !category || !unit || price == null || stock == null) {
      return NextResponse.json({ error: 'name, category, price, unit, stock required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('items')
      .insert({
        name,
        category,
        price: Number(price),
        unit,
        stock: Number(stock),
        barcode: barcode || null,
        image_url: image_url || null,
        image_emoji: image_emoji || '📦',
        description: description || null,
        is_new_arrival: !!is_new_arrival,
        is_offer: !!is_offer,
        offer_price: offer_price != null ? Number(offer_price) : null,
      })
      .select('id')
      .single();

    if (error) {
      // Fallback via RPC if RLS blocks direct insert
      const { error: rpcErr } = await supabase.rpc('bulk_upsert_items', {
        rows: [
          {
            name,
            category,
            price: Number(price),
            unit,
            stock: Number(stock),
            barcode: barcode || null,
            image_url: image_url || null,
            image_emoji: image_emoji || '📦',
            description: description || null,
            is_new_arrival: !!is_new_arrival,
            is_offer: !!is_offer,
            offer_price: offer_price != null ? Number(offer_price) : null,
          },
        ],
      });

      if (rpcErr) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: itemData } = await supabase
        .from('items')
        .select('id')
        .eq('name', name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const createdId = itemData?.id;
      if (createdId) {
        await supabase.from('items').update({
          is_new_arrival: !!is_new_arrival,
          is_offer: !!is_offer,
          offer_price: offer_price != null ? Number(offer_price) : null,
        }).eq('id', createdId);
      }

      return NextResponse.json({ ok: true, id: createdId || 'upserted' });
    }

    const createdId = data.id;
    if (createdId) {
      await supabase.from('items').update({
        is_new_arrival: !!is_new_arrival,
        is_offer: !!is_offer,
        offer_price: offer_price != null ? Number(offer_price) : null,
      }).eq('id', createdId);
    }

    return NextResponse.json({ ok: true, id: createdId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
