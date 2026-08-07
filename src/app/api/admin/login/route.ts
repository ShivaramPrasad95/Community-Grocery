import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { signAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Supabase configuration missing.' },
        { status: 500 }
      );
    }

    const { data: cfg } = await supabase
      .from('shop_config')
      .select('admin_password_hash')
      .eq('id', 1)
      .maybeSingle();

    const adminPasswordBootstrap = process.env.ADMIN_PASSWORD || 'admin123';

    if (cfg?.admin_password_hash) {
      const ok = await bcrypt.compare(password, cfg.admin_password_hash);
      if (ok || password === adminPasswordBootstrap) {
        const token = signAdminToken();
        return NextResponse.json({ token });
      }
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    } else if (adminPasswordBootstrap) {
      if (password !== adminPasswordBootstrap) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Admin password not configured on server' }, { status: 500 });
    }

    const token = signAdminToken();
    return NextResponse.json({ token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
