import axios from 'axios';

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  favicon: string;
}

/**
 * Fetches metadata from a URL including title, description, and social preview image
 * Uses a server-side API route to avoid CORS issues
 * @param url The URL to fetch metadata from
 * @returns Promise resolving to metadata object
 */
export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Default metadata - use the domain name as a fallback title
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (e) {
      console.warn('Could not parse domain from URL:', url);
    }
    
    const defaultMetadata: LinkMetadata = {
      title: domain || url,
      description: '',
      image: '',
      favicon: ''
    };
    
    // Use our server-side API route to fetch metadata
    console.log('Fetching metadata for:', url);
    const response = await axios.post('/api/metadata', { url }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    
    const metadata = response.data;
    console.log('Fetched metadata:', metadata);
    
    return {
      title: metadata.title || defaultMetadata.title,
      description: metadata.description || defaultMetadata.description,
      image: metadata.image || defaultMetadata.image,
      favicon: metadata.favicon || defaultMetadata.favicon
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error);
    // Try to extract domain as a fallback title
    let title = url;
    try {
      title = new URL(url).hostname.replace('www.', '');
    } catch {}
    
    return {
      title,
      description: '',
      image: '',
      favicon: ''
    };
  }
}
