import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// --- CONFIGURABLE PROTECTION SETTINGS ---
const COOLDOWN_PER_LINK_MINUTES = 10; // User/IP can only earn Qubits for the same link every 10 min
const GLOBAL_RATE_LIMIT_CLICKS = 10; // Max clicks per window
const GLOBAL_RATE_LIMIT_WINDOW_MINUTES = 5; // Window for global rate limit


// For Google reCAPTCHA verification
async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error('RECAPTCHA_SECRET_KEY not set in environment');
    return false;
  }
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json();
    return !!data.success;
  } catch (e) {
    console.error('Error verifying reCAPTCHA:', e);
    return false;
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { link_id, user_id, captcha_token } = await req.json();
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const now = new Date();

    if (!link_id) {
      return NextResponse.json({ error: 'Missing link_id' }, { status: 400 });
    }

    // --- 1. Per-link cooldown check ---
    const { data: recentClick } = await supabase
      .from('link_clicks')
      .select('id, clicked_at')
      .eq('link_id', link_id)
      .or(`ip_address.eq.${ip},user_id.eq.${user_id}`)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentClick && recentClick.clicked_at) {
      const lastClick = new Date(recentClick.clicked_at);
      const diffMinutes = (now.getTime() - lastClick.getTime()) / 60000;
      if (diffMinutes < COOLDOWN_PER_LINK_MINUTES) {
        return NextResponse.json({ error: 'Cooldown active for this link.' }, { status: 429 });
      }
    }

    // --- 2. Global rate limit check ---
    const since = new Date(now.getTime() - GLOBAL_RATE_LIMIT_WINDOW_MINUTES * 60000).toISOString();
    const { count: recentCount } = await supabase
      .from('link_clicks')
      .select('id', { count: 'exact', head: true })
      .or(`ip_address.eq.${ip},user_id.eq.${user_id}`)
      .gte('clicked_at', since);

    let suspicious = false;
    if ((recentCount || 0) >= GLOBAL_RATE_LIMIT_CLICKS) {
      suspicious = true;
    }

    // --- 3. CAPTCHA required for suspicious activity ---
    if (suspicious) {
      if (!captcha_token) {
        return NextResponse.json({ captcha_required: true, error: 'CAPTCHA required due to suspicious activity.' }, { status: 403 });
      }
      const valid = await verifyCaptcha(captcha_token);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid CAPTCHA.' }, { status: 403 });
      }
    }

    // --- 4. Record the click ---
    const { error: insertError } = await supabase.from('link_clicks').insert({
      link_id,
      user_id: user_id || null,
      clicked_at: now.toISOString(),
      ip_address: ip,
      user_agent: userAgent,
    });
    if (insertError) {
      return NextResponse.json({ error: 'Failed to record click.' }, { status: 500 });
    }

    // Optionally: increment Qubits here (not shown)
    return NextResponse.json({ success: true, suspicious });
  } catch (e) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
