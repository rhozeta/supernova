import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// --- CONFIGURABLE PROTECTION SETTINGS ---
const COOLDOWN_PER_LINK_MINUTES = 1; // User/IP can only earn Qubits for the same link every 1 min
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
  console.log('API /api/click called');
  try {
    const body = await req.json();
    console.log('Request body:', body);
    // Print a stack trace for every call for debugging
    console.trace('API /api/click stack trace');
    const { link_id, user_id, captcha_token } = body;
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const now = new Date();
    console.log('Parsed values:', { link_id, user_id, captcha_token, ip, userAgent });
    const orCondition = user_id ? `ip_address.eq.${ip},user_id.eq.${user_id}` : `ip_address.eq.${ip}`;

    if (!link_id) {
      console.error('Missing link_id in request');
      return NextResponse.json({ error: 'Missing link_id' }, { status: 400 });
    }

    // --- 1. Per-link cooldown check ---
    let recentClick;
    try {
      // Only check for cooldown for this specific link and user/ip
      let clickQuery = supabase
        .from('link_clicks')
        .select('id, clicked_at')
        .eq('link_id', link_id)
        .order('clicked_at', { ascending: false })
        .limit(1);
      if (user_id) {
        clickQuery = clickQuery.eq('user_id', user_id);
      } else {
        clickQuery = clickQuery.eq('ip_address', ip);
      }
      const { data, error } = await clickQuery.maybeSingle();
      if (error) {
        console.error('Supabase error in cooldown check:', error);
      }
      recentClick = data;
    } catch (err) {
      console.error('Exception in cooldown check:', err);
    }

    // Only enforce cooldown if there is at least one previous click for this link by this user/ip
    if (recentClick && recentClick.clicked_at) {
      const lastClick = new Date(recentClick.clicked_at);
      const diffMinutes = (now.getTime() - lastClick.getTime()) / 60000;
      console.log('Cooldown debug:', {
        now: now.toISOString(),
        lastClick: lastClick.toISOString(),
        diffMinutes,
        cooldown: COOLDOWN_PER_LINK_MINUTES,
        recentClick,
      });
      if (diffMinutes < COOLDOWN_PER_LINK_MINUTES) {
        // If still in cooldown, do not insert a new click or reset cooldown
        return NextResponse.json({ error: 'Cooldown active for this link.', cooldown_debug: {
          now: now.toISOString(),
          lastClick: lastClick.toISOString(),
          cooldown: COOLDOWN_PER_LINK_MINUTES
        } }, { status: 429 });
      }
    } else {
      console.log('Cooldown debug: No recentClick found for this link/user/ip. No cooldown enforced.');
    }
    // If no previous click, allow the click (no cooldown enforced)


    // --- 2. Global rate limit check ---
    const since = new Date(now.getTime() - GLOBAL_RATE_LIMIT_WINDOW_MINUTES * 60000).toISOString();
    let recentCount = 0;
    try {
      const { count, error } = await supabase
        .from('link_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('clicked_at', since);
      if (error) {
        console.error('Supabase error in rate limit check:', error);
      }
      recentCount = count || 0;
    } catch (err) {
      console.error('Exception in rate limit check:', err);
    }

    let suspicious = false;
    if (recentCount >= GLOBAL_RATE_LIMIT_CLICKS) {
      suspicious = true;
    }
    console.log('Suspicious:', suspicious, 'recentCount:', recentCount);

    // --- 3. CAPTCHA required for suspicious activity ---
    if (suspicious) {
      if (!captcha_token) {
        console.warn('CAPTCHA required but no token provided');
        return NextResponse.json({ captcha_required: true, error: 'CAPTCHA required due to suspicious activity.' }, { status: 403 });
      }
      const valid = await verifyCaptcha(captcha_token);
      console.log('CAPTCHA validation result:', valid);
      if (!valid) {
        console.warn('Invalid CAPTCHA');
        return NextResponse.json({ error: 'Invalid CAPTCHA.' }, { status: 403 });
      }
    }

    // --- 4. Record the click only if user passes bot/captcha checks ---
    // (This is now guaranteed, since all suspicious/captcha failures return early above)
    // Only insert into link_clicks if this is not the first creation of the link, but an actual redirect/click
    // (No change needed here if link creation does NOT insert into link_clicks table)
    try {
      console.log('Inserting click into link_clicks:', {
        link_id,
        user_id: user_id || null,
        clicked_at: now.toISOString(),
        ip_address: ip,
        user_agent: userAgent,
      });
      const { error: insertError } = await supabase.from('link_clicks').insert({
        link_id,
        user_id: user_id || null,
        clicked_at: now.toISOString(),
        ip_address: ip,
        user_agent: userAgent,
      });
      if (insertError) {
        console.error('Supabase error inserting click:', insertError);
        return NextResponse.json({ error: 'Failed to record click.' }, { status: 500 });
      }
    } catch (err) {
      console.error('Exception inserting click:', err);
      return NextResponse.json({ error: 'Failed to record click.' }, { status: 500 });
    }

    // Optionally: increment Qubits here (not shown)
    console.log('Click recorded successfully');
    return NextResponse.json({ success: true, suspicious });
  } catch (e) {
    console.error('API /api/click error:', e);
    console.trace('API /api/click error stack trace');
    if (e instanceof Error) {
      return NextResponse.json({ error: 'Server error', message: e.message, stack: e.stack }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'Server error', detail: JSON.stringify(e) }, { status: 500 });
    }
  }
}
