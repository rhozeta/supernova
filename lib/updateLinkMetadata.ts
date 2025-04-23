import { supabase } from './supabaseClient';
import { fetchMetadata } from './fetchMetadata';

/**
 * Updates metadata for a specific link
 * @param linkId The ID of the link to update
 * @returns Promise resolving to a boolean indicating success
 */
export async function updateLinkMetadata(linkId: string): Promise<boolean> {
  try {
    // First, get the link's original URL
    const { data: link, error: fetchError } = await supabase
      .from('links')
      .select('original_url')
      .eq('id', linkId)
      .single();
    
    if (fetchError || !link) {
      console.error('Error fetching link:', fetchError);
      return false;
    }
    
    // Update the link to show it's being processed
    await supabase
      .from('links')
      .update({
        page_title: 'Updating metadata...',
      })
      .eq('id', linkId);
    
    // Fetch metadata for the link using our server-side API
    const metadata = await fetchMetadata(link.original_url);
    
    // Update the link with the fetched metadata
    const { error: updateError } = await supabase
      .from('links')
      .update({
        page_title: metadata.title || link.original_url,
        page_description: metadata.description || '',
        page_image: metadata.image || '',
        page_favicon: metadata.favicon || ''
      })
      .eq('id', linkId);
    
    if (updateError) {
      console.error('Error updating link metadata:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error updating link metadata:', error);
    return false;
  }
}

/**
 * Updates metadata for all links belonging to a user
 * @param userId The user ID whose links should be updated
 * @returns Promise resolving to the number of successfully updated links
 */
export async function updateAllUserLinkMetadata(userId: string): Promise<number> {
  try {
    // Get all links for the user
    const { data: links, error: fetchError } = await supabase
      .from('links')
      .select('id, original_url')
      .eq('user_id', userId)
      .eq('deleted', false);
    
    if (fetchError || !links) {
      console.error('Error fetching links:', fetchError);
      return 0;
    }
    
    // First mark all links as updating
    await supabase
      .from('links')
      .update({
        page_title: 'Updating metadata...'
      })
      .in('id', links.map(link => link.id));
    
    let successCount = 0;
    
    // Process links in batches to avoid overwhelming the server
    const batchSize = 3; // Reduced batch size to avoid rate limiting
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      
      // Process each link in the batch concurrently
      const results = await Promise.allSettled(
        batch.map(async (link) => {
          try {
            // Add a small random delay to spread out requests
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
            
            const metadata = await fetchMetadata(link.original_url);
            
            const { error: updateError } = await supabase
              .from('links')
              .update({
                page_title: metadata.title || link.original_url,
                page_description: metadata.description || '',
                page_image: metadata.image || '',
                page_favicon: metadata.favicon || ''
              })
              .eq('id', link.id);
            
            return !updateError;
          } catch (error) {
            console.error(`Error updating metadata for link ${link.id}:`, error);
            // If there's an error, update the link to show the error
            try {
              await supabase
                .from('links')
                .update({
                  page_title: link.original_url // Reset to URL on error
                })
                .eq('id', link.id);
            } catch {}
            return false;
          }
        })
      );
      
      // Count successful updates
      successCount += results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      // Add a delay between batches to avoid rate limiting
      if (i + batchSize < links.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
      }
    }
    
    return successCount;
  } catch (error) {
    console.error('Unexpected error updating all link metadata:', error);
    return 0;
  }
}
