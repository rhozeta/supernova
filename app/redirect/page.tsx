import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function GET(req: NextRequest, { params }: { params: { shortcode: string } }) {
  const shortcode = params.shortcode;
  // Find link by shortcode
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', shortcode)
    .single();
  if (error || !link) {
    return NextResponse.redirect('/');
  }
  // Increment click count
  await supabase
    .from('links')
    .update({ click_count: (link.click_count || 0) + 1 })
    .eq('id', link.id);
  // Increment user points
  await supabase
    .from('profiles')
    .update({ points: (link.user_id && link.click_count !== undefined) ? link.click_count + 1 : 1 })
    .eq('id', link.user_id);
  // Redirect to the original URL
  return NextResponse.redirect(link.original_url);
}
