import { supabase } from '@/lib/supabaseClient';
import { redirect } from 'next/navigation';

interface PageProps {
  params: { code: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

// Ensure this page is dynamically rendered
export const dynamic = 'force-dynamic';

// Helper function to call the click API (fire-and-forget)
async function recordClick(linkId: string) {
  try {
    // Construct the full URL for the API endpoint using relative path
    const apiUrl = `/api/click`;
    console.log(`Recording click for link ${linkId} via API: ${apiUrl}`);

    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
export default async function ShortLinkPage(
  { params, searchParams }: PageProps
) {
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
      recordClick(link.id);

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
