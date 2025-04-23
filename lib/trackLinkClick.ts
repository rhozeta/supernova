import { supabase } from './supabaseClient';

/**
 * Tracks a link click by calling the backend API, handling CAPTCHA if needed
 * @param linkId The ID of the link that was clicked
 * @param shortCode The short code of the link that was clicked
 * @param captchaToken Optional CAPTCHA token if required
 * @returns An object with success, captchaRequired, and error fields
 */
export async function trackLinkClick(linkId: string, shortCode: string, captchaToken?: string): Promise<{ success: boolean; captchaRequired?: boolean; error?: string }> {
  // Try to extract utm_ref from the current URL (client-side only)
  let userIdFromUtm: string | undefined = undefined;
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      userIdFromUtm = url.searchParams.get('utm_ref') || undefined;
    } catch {}
  }
  console.log(`[trackLinkClick] Starting to track click for link ID: ${linkId}, shortCode: ${shortCode}`);
  
  try {
    const res = await fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link_id: linkId, captcha_token: captchaToken, user_id: userIdFromUtm }),
    });
    const result = await res.json();
    if (res.status === 200 && result.success) {
      return { success: true };
    } else if (result.captcha_required) {
      return { success: false, captchaRequired: true, error: result.error };
    } else {
      return { success: false, error: result.error || 'Click failed' };
    }
  } catch (error) {
    return { success: false, error: 'Network or server error' };
  }
}
