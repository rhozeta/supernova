import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { load } from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    // Default metadata with domain as fallback title
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (e) {
      console.warn('Could not parse domain from URL:', url);
    }
    
    const defaultMetadata = {
      title: domain || url,
      description: '',
      image: '',
      favicon: ''
    };
    
    try {
      // Fetch the HTML content with increased timeout
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000, // 10 second timeout
        maxRedirects: 5
      });
      
      const html = response.data;
      const $ = load(html);
      
      // Extract metadata with more fallback options
      let title = $('title').text().trim();
      if (!title) {
        title = $('meta[property="og:title"]').attr('content') || 
              $('meta[name="twitter:title"]').attr('content') || 
              $('h1').first().text().trim() || 
              defaultMetadata.title;
      }
      
      let description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || 
                      $('meta[name="twitter:description"]').attr('content') || '';
      
      // If no description, try to get the first paragraph
      if (!description) {
        description = $('p').first().text().trim().substring(0, 200);
        if (description.length === 200) description += '...';
      }
      
      // Try multiple image sources
      let image = $('meta[property="og:image"]').attr('content') || 
                $('meta[name="twitter:image"]').attr('content') || 
                $('meta[name="twitter:image:src"]').attr('content') || '';
      
      // If no social media image, try to get the first large image
      if (!image) {
        $('img').each((i, el) => {
          if (!image && $(el).attr('src') && 
              ($(el).attr('width') && parseInt($(el).attr('width') || '0') > 200 || 
              $(el).attr('height') && parseInt($(el).attr('height') || '0') > 200)) {
            image = $(el).attr('src') || '';
          }
        });
      }
      
      // Try multiple favicon sources
      const favicon = $('link[rel="icon"]').attr('href') || 
                    $('link[rel="shortcut icon"]').attr('href') || 
                    $('link[rel="apple-touch-icon"]').attr('href') || 
                    `//${new URL(url).hostname}/favicon.ico`; // Fallback to default favicon location
      
      // Construct metadata object
      const metadata = {
        title: title || defaultMetadata.title,
        description: description || defaultMetadata.description,
        image: image || defaultMetadata.image,
        favicon: favicon || defaultMetadata.favicon
      };
      
      // Resolve relative URLs for images and favicons
      if (metadata.image && !metadata.image.startsWith('http')) {
        try {
          // Handle protocol-relative URLs (starting with //)
          if (metadata.image.startsWith('//')) {
            metadata.image = `https:${metadata.image}`;
          } else {
            const baseUrl = new URL(url);
            metadata.image = new URL(metadata.image, baseUrl.origin).toString();
          }
        } catch (e) {
          console.warn('Could not resolve relative image URL:', metadata.image);
        }
      }
      
      if (metadata.favicon && !metadata.favicon.startsWith('http')) {
        try {
          // Handle protocol-relative URLs (starting with //)
          if (metadata.favicon.startsWith('//')) {
            metadata.favicon = `https:${metadata.favicon}`;
          } else {
            const baseUrl = new URL(url);
            metadata.favicon = new URL(metadata.favicon, baseUrl.origin).toString();
          }
        } catch (e) {
          console.warn('Could not resolve relative favicon URL:', metadata.favicon);
        }
      }
      
      return NextResponse.json(metadata);
    } catch (error) {
      console.error(`Error fetching metadata for ${url}:`, error);
      // Return default metadata on error
      return NextResponse.json(defaultMetadata);
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}
