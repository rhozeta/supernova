import axios from 'axios';
import { load } from 'cheerio';

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  favicon: string;
}

/**
 * Fetches metadata from a URL including title, description, and social preview image
 * @param url The URL to fetch metadata from
 * @returns Promise resolving to metadata object
 */
export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Default metadata
    const defaultMetadata: LinkMetadata = {
      title: url,
      description: '',
      image: '',
      favicon: ''
    };
    
    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000 // 5 second timeout
    });
    
    const html = response.data;
    const $ = load(html);
    
    // Extract metadata
    const metadata: LinkMetadata = {
      title: $('title').text().trim() || defaultMetadata.title,
      description: $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content') || 
                  defaultMetadata.description,
      image: $('meta[property="og:image"]').attr('content') || 
             $('meta[name="twitter:image"]').attr('content') || 
             defaultMetadata.image,
      favicon: $('link[rel="icon"]').attr('href') || 
               $('link[rel="shortcut icon"]').attr('href') || 
               defaultMetadata.favicon
    };
    
    // Resolve relative URLs for images and favicons
    if (metadata.image && !metadata.image.startsWith('http')) {
      const baseUrl = new URL(url);
      metadata.image = new URL(metadata.image, baseUrl.origin).toString();
    }
    
    if (metadata.favicon && !metadata.favicon.startsWith('http')) {
      const baseUrl = new URL(url);
      metadata.favicon = new URL(metadata.favicon, baseUrl.origin).toString();
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error);
    return {
      title: url,
      description: '',
      image: '',
      favicon: ''
    };
  }
}
