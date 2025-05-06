import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { Metadata } from 'next';
import ClickWithCaptchaWrapper from '../../components/ClickWithCaptchaWrapper';

type Params = Promise<{ short_code: string }>;
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function ShortCodePage({ params }: { params: Params }) {
  const { short_code } = await params;

  // Find link by shortcode
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', short_code)
    .single();

  if (error || !link) {
    return redirect('/404');
  }
  if (link.deleted === true) {
    // If the link is deleted, redirect straight to the original URL (for link_refs and any case)
    return redirect(link.original_url);
  }

  // Parse utm_ref from the short link (if present)
  let referrer = null;
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    referrer = urlParams.get('utm_ref');
  } else if (params && typeof params === 'object' && 'utm_ref' in params) {
    referrer = params.utm_ref;
  } else {
    // Try to parse from process.env if SSR (fallback)
    const search = (typeof location !== 'undefined') ? location.search : '';
    if (search) {
      const urlParams = new URLSearchParams(search);
      referrer = urlParams.get('utm_ref');
    }
  }

  // Server-side: try to auto-record click and redirect if not suspicious/no captcha required
  const apiRes = await fetch(
    '/api/click', // Use relative path for internal API calls
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link_id: link.id, referrer }),
      cache: 'no-store',
    }
  );
  const apiResponse = await apiRes.json();
  if (apiRes.ok && !apiResponse.captcha_required && !apiResponse.suspicious) {
    // Auto-redirect if not suspicious and no captcha required
    return redirect(link.original_url);
  }

  // If on cooldown (status 429 and error === 'Cooldown active for this link.'), show cooldown info and metadata
  if (apiRes.status === 429 && apiResponse.error === 'Cooldown active for this link.') {
    // Try to get cooldown debug info from headers or API debug logs (if exposed)
    // We'll assume the API returns a field like cooldown_debug if available
    const cooldownDebug = apiResponse.cooldown_debug || {};
    // Fallback: try to get lastClick and cooldown from the API logs if exposed, otherwise estimate
    let secondsLeft = 0;
    if (cooldownDebug.lastClick && cooldownDebug.cooldown) {
      const now = cooldownDebug.now ? new Date(cooldownDebug.now) : new Date();
      const lastClick = new Date(cooldownDebug.lastClick);
      const cooldownMs = cooldownDebug.cooldown * 60 * 1000;
      const nextAllowed = lastClick.getTime() + cooldownMs;
      const secondsLeftRaw = Math.ceil((nextAllowed - now.getTime()) / 1000);
      secondsLeft = Math.max(0, secondsLeftRaw);
    } else {
      // If not available, just show a generic message
      secondsLeft = 60; // fallback to 1 minute max
    }
    function formatTime(secs: number) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-md w-full p-6 flex flex-col items-center">
          <div className="flex items-center mb-4">
            {link.page_favicon && <img src={link.page_favicon} alt="Favicon" className="h-6 w-6 mr-2 rounded" />}
            <span className="text-lg font-semibold text-gray-900 dark:text-white">{link.page_title || link.original_url}</span>
          </div>
          {link.page_image && (
            <img src={link.page_image} alt="Thumbnail" className="rounded-lg shadow mb-4 max-h-48 object-contain bg-gray-100 dark:bg-gray-800" />
          )}
          <div className="text-orange-600 font-bold text-lg mb-2">This link is on cooldown because you accessed it recently.</div>
          <div className="text-gray-700 dark:text-gray-300 mb-4">Time remaining: <span className="font-mono">{formatTime(secondsLeft)}</span></div>
          <div className="text-gray-500 break-all text-center">{link.original_url}</div>
        </div>
      </div>
    );
  }

  // Otherwise, render the click/captcha page
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">You are about to visit:</h1>
      <div className="mb-6 text-lg text-blue-600 break-all">{link.original_url}</div>
      <ClickWithCaptchaWrapper
        linkId={link.id}
        shortCode={short_code}
        originalUrl={link.original_url}
      />
    </div>
  );
}
