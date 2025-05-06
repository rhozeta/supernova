import { supabase } from '@/lib/supabaseClient';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

type Props = {
  params: { code: string };
};

// Ensure this page is dynamically rendered
export const dynamic = 'force-dynamic';

// Helper function to call the click API (fire-and-forget)
async function recordClick(linkId: string, request: NextRequest) {
  try {
    // Construct the full URL for the API endpoint
    const apiUrl = `${request.nextUrl.origin}/api/click`;
    console.log(`Recording click for link ${linkId} via API: ${apiUrl}`);

    // We don't necessarily need user_id or captcha here for a simple redirect click log
    // but include basics like IP and User-Agent if needed by the API
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'unknown',
        'X-Forwarded-For': request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      },
      body: JSON.stringify({ link_id: linkId }),
    });
    console.log(`Successfully sent click record request for link ${linkId}`);
  } catch (error) {
    console.error(`Failed to record click for link ${linkId}:`, error);
    // Don't block the redirect even if click recording fails
  }
}

// Note: The second argument 'request' is implicitly passed by Next.js App Router
// when the page is dynamically rendered.
export default async function ShortLinkPage({ params }: Props, request: NextRequest) {
  const { code } = params;
  console.log(`Handling short code: ${code}`);

  if (!code) {
    console.log('No short code provided, redirecting to home.');
    redirect('/'); // Redirect to home or a specific error page if no code
  }

  try {
    const { data: link, error } = await supabase
      .from('links')
      .select('id, original_url') // Select id for click tracking
      .eq('short_code', code)
      .single();

    if (error || !link) {
      console.error(`Error fetching link for code ${code}:`, error);
      // Handle link not found - redirect to a custom 404 or home
      redirect('/not-found'); // Or create a specific link-not-found page
    }

    if (link && link.original_url) {
      console.log(`Found link ${link.id}, redirecting to: ${link.original_url}`);
      
      // Record the click asynchronously (don't await)
      // Pass the implicit 'request' object to the helper
      recordClick(link.id, request);

      // Perform the redirect
      redirect(link.original_url);
    } else {
       console.log(`Link found for code ${code} but has no original_url.`);
       redirect('/not-found'); // Link exists but is invalid
    }
  } catch (err) {
    console.error(`Unexpected error handling short code ${code}:`, err);
    redirect('/error'); // Redirect to a generic error page
  }

  // Fallback return (should not be reached due to redirects)
  return <div>Redirecting...</div>;
}
