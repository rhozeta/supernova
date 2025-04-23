import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { trackLinkClick } from '../../lib/trackLinkClick';
import { Metadata } from 'next';

export default async function ShortCodePage({ params }: { params: { short_code: string } }) {
  const { short_code } = params;
  
  console.log(`[ShortCodePage] Processing shortcode: ${short_code}`);
  
  // Find link by shortcode
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', short_code)
    .single();
    
  console.log(`[ShortCodePage] Link data:`, link ? { id: link.id, short_code: link.short_code, deleted: link.deleted } : 'Not found');
  
  if (error) {
    console.log(`[ShortCodePage] Link not found for shortcode: ${short_code}`);
    // This is an expected path for non-existent shortcodes
    return redirect('/404');
  }
  
  if (!link) {
    console.log(`[ShortCodePage] Link is null for shortcode: ${short_code}`);
    return redirect('/404');
  }
  
  // Check if link is deleted
  if (link.deleted === true) {
    console.log(`[ShortCodePage] Link is deleted, redirecting to login`);
    return redirect('/login');
  }
  
  // Track the click with detailed logging
  console.log(`[ShortCodePage] Tracking click for link ID: ${link.id}, shortcode: ${short_code}`);
  
  try {
    // First, directly insert into link_clicks table
    const { data: clickData, error: clickError } = await supabase
      .from('link_clicks')
      .insert({
        link_id: link.id,
        clicked_at: new Date().toISOString()
        // No other fields required - referrer, user_agent, ip_address, and country are optional
      });
      
    console.log(`[ShortCodePage] Direct insert result:`, clickError ? `Failed: ${clickError.message}` : 'Success');
    
    // Also try the trackLinkClick function as a backup
    await trackLinkClick(link.id, short_code);
    
    // Manually update the click count as a fallback
    await supabase
      .from('links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id);
  } catch (trackError) {
    // Log but continue - tracking errors shouldn't prevent redirection
    console.error(`[ShortCodePage] Error tracking click:`, trackError);
  }

  console.log(`[ShortCodePage] Redirecting to: ${link.original_url}`);
  // Redirect to the original URL
  return redirect(link.original_url);
  return null;
}
