import { supabase } from './supabaseClient';

/**
 * Tracks a link click by recording it in the link_clicks table and updating the click_count
 * @param linkId The ID of the link that was clicked
 * @param shortCode The short code of the link that was clicked
 * @returns A promise that resolves when the click has been tracked
 */
export async function trackLinkClick(linkId: string, shortCode: string): Promise<void> {
  console.log(`[trackLinkClick] Starting to track click for link ID: ${linkId}, shortCode: ${shortCode}`);
  
  try {
    // First, insert into the link_clicks table
    console.log(`[trackLinkClick] Inserting into link_clicks table...`);
    console.log(`[trackLinkClick] Insert payload: { link_id: ${linkId}, clicked_at: ${new Date().toISOString()} }`);
    
    const { data: clickData, error: clickError } = await supabase
      .from('link_clicks')
      .insert({
        link_id: linkId,
        clicked_at: new Date().toISOString()
        // Only using required fields from the schema
      });

    if (clickError) {
      console.error(`[trackLinkClick] Error inserting into link_clicks table:`, clickError);
      console.error(`[trackLinkClick] Error code: ${clickError.code}, message: ${clickError.message}`);
      
      // Skip the RPC approach since it's not working
      console.log(`[trackLinkClick] Skipping RPC approach and proceeding to direct update...`);
      
      // We'll rely on the direct click_count update below instead
    } else {
      console.log(`[trackLinkClick] Successfully inserted into link_clicks table`);
    }
    
    // As a fallback, also update the click_count directly
    console.log(`[trackLinkClick] Updating click count directly...`);
    try {
      const { data: link, error: getLinkError } = await supabase
        .from('links')
        .select('click_count')
        .eq('id', linkId)
        .single();
      
      if (getLinkError) {
        console.error(`[trackLinkClick] Error fetching link:`, getLinkError);
      } else if (link) {
        const currentCount = link.click_count || 0;
        console.log(`[trackLinkClick] Current click count: ${currentCount}, updating to ${currentCount + 1}`);
        
        const { error: updateError } = await supabase
          .from('links')
          .update({ click_count: currentCount + 1 })
          .eq('id', linkId);
        
        if (updateError) {
          console.error(`[trackLinkClick] Error updating click count:`, updateError);
        } else {
          console.log(`[trackLinkClick] Successfully updated click count to ${currentCount + 1}`);
        }
      }
    } catch (updateError) {
      console.error(`[trackLinkClick] Error in direct click count update:`, updateError);
    }
  } catch (error) {
    console.error(`[trackLinkClick] Unexpected error in trackLinkClick:`, error);
    
    // Last resort fallback - simple increment without RPC
    try {
      console.log(`[trackLinkClick] Attempting last resort direct increment...`);
      // First get the current count
      const { data: linkData, error: linkError } = await supabase
        .from('links')
        .select('click_count')
        .eq('id', linkId)
        .single();
        
      if (!linkError && linkData) {
        const currentCount = linkData.click_count || 0;
        // Then increment it
        await supabase
          .from('links')
          .update({ click_count: currentCount + 1 })
          .eq('id', linkId);
        console.log(`[trackLinkClick] Last resort increment succeeded: ${currentCount} → ${currentCount + 1}`);
      } else {
        console.error(`[trackLinkClick] Last resort increment failed to get current count:`, linkError);
      }
    } catch (lastError) {
      console.error(`[trackLinkClick] Last resort update failed:`, lastError);
    }
  }
}
