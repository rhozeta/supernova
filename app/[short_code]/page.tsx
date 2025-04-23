import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { Metadata } from 'next';
import ClickWithCaptchaWrapper from '../../components/ClickWithCaptchaWrapper';

type Params = Promise<{ short_code: string }>;
import React from 'react';

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
    return redirect('/login');
  }

  // Render a page with a click button that uses ClickWithCaptcha
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
