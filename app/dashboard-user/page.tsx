"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';
import { useThemeManager } from '../../lib/useTheme';
import { fetchMetadata } from '../../lib/fetchMetadata';
import { updateAllUserLinkMetadata, updateLinkMetadata } from '../../lib/updateLinkMetadata';
import NavMenu from '../components/NavMenu';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [links, setLinks] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'clicks'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [contentCreator, setContentCreator] = useState(false);
  const [origin, setOrigin] = useState('');
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'all'>('active');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const router = useRouter();

  // Fetch user on mount before rendering
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        setUserChecked(true);
        return;
      } else {
        setUser(user);
        setUserChecked(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('content_creator')
          .eq('id', user.id)
          .single();
        if (data?.content_creator) {
          router.push('/dashboard');
        }
      }
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchLinks();
      fetchPoints();
      fetchTotalClicks();
      fetchContentCreator();
    }
    // Set the origin for client-side only
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, [user]);

  // Fetch content creator status
  const fetchContentCreator = async () => {
    if (!user || !user.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('content_creator')
      .eq('id', user.id)
      .single();
    if (!error && data) setContentCreator(data.content_creator);
  };

  // Update content creator status
  const handleContentCreatorToggle = async () => {
    if (!user || !user.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ content_creator: !contentCreator })
      .eq('id', user.id);
    if (!error) setContentCreator(!contentCreator);
  };

  // Always fetch links when switching tabs
  useEffect(() => {
    if (user) {
      fetchLinks();
    }
    // eslint-disable-next-line
  }, [activeTab, user]);

  // Extract domain from URL
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'unknown';
    }
  };

  // Update available domains for filtering
  const updateAvailableDomains = (links: any[]) => {
    const domains = links.map(link => extractDomain(link.original_url));
    const uniqueDomains = ['all', ...new Set(domains)];
    setAvailableDomains(uniqueDomains);
  };

  // --- LinkRefs click counts ---
  const [linkRefsClickCounts, setLinkRefsClickCounts] = useState<{[original_link_id: string]: number}>({});

  // Fetch click counts from link_refs for this user
  useEffect(() => {
    async function fetchLinkRefsClicks() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('link_refs')
        .select('original_link_id, click_count')
        .eq('user_id', user.id);
      if (!error && data) {
        // Aggregate click counts by original_link_id
        const counts: {[original_link_id: string]: number} = {};
        data.forEach((ref: any) => {
          if (!counts[ref.original_link_id]) counts[ref.original_link_id] = 0;
          counts[ref.original_link_id] += ref.click_count || 0;
        });
        setLinkRefsClickCounts(counts);
      }
    }
    fetchLinkRefsClicks();
  }, [user, links]);

  // Apply domain filter and sorting to links (no deleted filter here)
  const [filteredLinks, setFilteredLinks] = useState<any[]>([]);
  useEffect(() => {
    if (links.length > 0) {
      let result = [...links];
      // Apply domain filter
      if (domainFilter !== 'all') {
        result = result.filter(link => extractDomain(link.original_url) === domainFilter);
      }
      // Filter by active/archived tab
      if (activeTab === 'active') {
        result = result.filter(link => {
          if (link._linkType === 'ref') {
            return !link.removed_by_user;
          }
          return !link.deleted;
        });
      } else if (activeTab === 'archived') {
        result = result.filter(link => {
          if (link._linkType === 'ref') {
            return link.removed_by_user;
          }
          return link.deleted;
        });
      } else if (activeTab === 'all') {
        // Do not filter by deleted/archived status, show all links
        // Only domain filter and search filter apply
      }
      // Apply search filter (broad, case-insensitive)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        result = result.filter(link => {
          const pageTitle = (link.page_title || '').toLowerCase();
          const creatorUsername = (link.original_creator?.username || link.user?.username || '').toLowerCase();
          const originalUrl = (link.original_url || '').toLowerCase();
          const domain = extractDomain(link.original_url).toLowerCase();
          return (
            pageTitle.includes(term) ||
            creatorUsername.includes(term) ||
            originalUrl.includes(term) ||
            domain.includes(term)
          );
        });
      }
      // Apply sorting
      if (sortBy === 'date') {
        result.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else if (sortBy === 'clicks') {
        result.sort((a, b) => {
          return sortDirection === 'asc' ? (a.click_count || 0) - (b.click_count || 0) : (b.click_count || 0) - (a.click_count || 0);
        });
      }
      setFilteredLinks(result);
    } else {
      setFilteredLinks([]);
    }
  }, [links, domainFilter, sortBy, sortDirection, activeTab, searchTerm]);

  const fetchLinks = async () => {
    if (!user || !user.id) return;
    // Fetch user's own links
    const { data: ownLinks, error: ownLinksError } = await supabase
      .from('links')
      .select('*, original_creator: user_id (id, username)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch link_refs (saved from creators)
    const { data: refLinks, error: refLinksError } = await supabase
      .from('link_refs')
      .select('*, original_link: original_link_id(*, user_id, user: user_id (id, username), deleted), removed_by_creator')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // If the original link is deleted, mark removed_by_creator=true in link_refs (client-side fallback, but should be handled in DB trigger in production)
    const refLinksWithType = (refLinks || []).map(l => {
      const removedByCreator = l.removed_by_creator !== undefined ? l.removed_by_creator : (l.original_link && l.original_link.deleted === true);
      const removedByUser = l.removed_by_user === true;
      return {
        ...l,
        ...l.original_link,
        _linkType: 'ref',
        original_creator: l.original_link && l.original_link.user_id ? { id: l.original_link.user_id, username: l.original_link.user?.username } : null,
        utm_param: l.utm_param,
        ref_id: l.id,
        removed_by_creator: removedByCreator,
        removed_by_user: removedByUser,
      };
    });

    // Merge and mark type for UI
    const ownLinksWithType = (ownLinks || []).map(l => ({ ...l, _linkType: 'original' }));

    // Combine for display, originals first
    const allForDisplay = [...ownLinksWithType, ...refLinksWithType];
    setLinks(allForDisplay);
    setAllLinks(ownLinks || []);
    updateAvailableDomains(ownLinks || []);
    fetchTotalClicks();
  };

  // Fetch the username from profiles table
  const fetchUsername = async () => {
    if (!user || !user.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    if (!error && data && data.username) setUsername(data.username);
    else setUsername('N/A');
  };

  // Fetch the total click count for all user's links
  const fetchTotalClicks = async () => {
    if (!user || !user.id) return;
    // Count clicks from ALL links, regardless of deleted status
    const { data, error } = await supabase
      .from('links')
      .select('click_count')
      .eq('user_id', user.id);
    
    if (!error && data) {
      const total = data.reduce((sum, link) => sum + (link.click_count || 0), 0);
      setTotalClicks(total);
    }
  };

  // Fetch the user's points
  const fetchPoints = async () => {
    if (!user || !user.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user.id)
      .single();
    if (!error && data) setPoints(data.points);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate URL
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      try {
        new URL(formattedUrl); // This will throw if URL is invalid
      } catch (urlError) {
        alert('Please enter a valid URL');
        setLoading(false);
        return;
      }
      
      // Generate a short code
      const short_code = Math.random().toString(36).substring(2, 8);
      
      if (!user || !user.id) {
        alert('You must be logged in to create a link.');
        setLoading(false);
        return;
      }
      
      // Show loading state in UI
      setLinks(prev =>
        prev.map(link =>
          link.id === 'temp-' + Date.now()
            ? { ...link, isLoading: true }
            : link
        )
      );
      
      // Initial payload without metadata fields
      const initialPayload = {
        user_id: user.id,
        original_url: formattedUrl,
        short_code,
        deleted: false
      };
      
      // Insert the link with placeholder metadata (DO NOT insert anything into link_clicks here)
      const { data: newLink, error: insertError } = await supabase
        .from('links')
        .insert(initialPayload)
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', insertError);
        alert('Failed to create link: ' + insertError.message);
        // Remove the temporary loading link
        setLinks(prevLinks => prevLinks.filter(link => link.id !== 'temp-' + Date.now()));
        setLoading(false);
        return;
      }
      
      console.log('Link created successfully, fetching metadata...');
      
      // Fetch metadata immediately
      try {
        const metadata = await fetchMetadata(formattedUrl);
        console.log('Metadata fetched:', metadata);
        
        // Update the link with the fetched metadata
        const { error: updateError } = await supabase
          .from('links')
          .update({
            page_title: metadata.title || formattedUrl,
            page_description: metadata.description || '',
            page_image: metadata.image || '',
            page_favicon: metadata.favicon || ''
          })
          .eq('id', newLink.id);
        
        if (updateError) {
          console.error('Metadata update error:', updateError);
        } else {
          console.log('Metadata updated successfully');
        }
      } catch (metadataError) {
        console.error('Error fetching metadata:', metadataError);
        // Even if metadata fetch fails, we still have a valid link
      }
      
      // Clear input and refresh links
      setUrl('');
      // Fetch links to get the updated list with metadata
      fetchLinks();
    } catch (err) {
      console.error('Unexpected error creating link:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleArchive = async (linkId: string, refId?: string) => {
    if (contentCreator) {
      // Content creators archive the original link
      const { error } = await supabase
        .from('links')
        .update({ deleted: true })
        .eq('id', linkId);
      if (error) {
        console.error('Archive error:', error);
        alert('Failed to archive link: ' + error.message);
      } else {
        fetchLinks();
        fetchPoints();
      }
    } else {
      // Non-creators remove the reference from their dashboard
      if (!refId) {
        alert('Reference ID missing for link removal.');
        return;
      }
      const { error } = await supabase
        .from('link_refs')
        .update({ removed_by_user: true })
        .eq('id', refId);
      if (error) {
        console.error('Remove reference error:', error);
        alert('Failed to remove link from dashboard: ' + error.message);
      } else {
        fetchLinks();
      }
    }
  };
  
  const handleRestore = async (linkId: string, refId?: string, linkType?: string) => {
    if (linkType === 'ref' && refId) {
      // Restore a reference link for the user
      const { error } = await supabase
        .from('link_refs')
        .update({ removed_by_user: false })
        .eq('id', refId);
      if (error) {
        console.error('Restore reference error:', error);
        alert('Failed to restore link to dashboard: ' + error.message);
      } else {
        fetchLinks();
      }
    } else {
      // Restore a deleted original link
      const { error } = await supabase
        .from('links')
        .update({ deleted: false })
        .eq('id', linkId);
      if (error) {
        console.error('Restore error:', error);
        alert('Failed to restore link: ' + error.message);
      } else {
        fetchLinks();
        fetchPoints();
      }
    }
  };

  // Function to refresh metadata for all user links
  const handleRefreshAllMetadata = async () => {
    if (!user || !user.id) return;
    
    setRefreshingMetadata(true);
    try {
      const updatedCount = await updateAllUserLinkMetadata(user.id);
      fetchLinks();
      alert(`Successfully updated metadata for ${updatedCount} links.`);
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      alert('There was an error refreshing link metadata.');
    } finally {
      setRefreshingMetadata(false);
    }
  };
  
  // Function to refresh metadata for a single link
  const [refreshingLinkIds, setRefreshingLinkIds] = useState<string[]>([]);
  
  const handleRefreshLinkMetadata = async (linkId: string) => {
    if (refreshingLinkIds.includes(linkId)) return;
    
    setRefreshingLinkIds(prev => [...prev, linkId]);
    try {
      const success = await updateLinkMetadata(linkId);
      if (success) {
        fetchLinks();
      } else {
        alert('Failed to update link metadata. Please try again.');
      }
    } catch (error) {
      console.error('Error refreshing link metadata:', error);
      alert('There was an error refreshing link metadata.');
    } finally {
      setRefreshingLinkIds(prev => prev.filter(id => id !== linkId));
    }
  };

  // Subscribe to link_clicks inserts and update click counts in real time
  useEffect(() => {
    const clickChannel = supabase
      .channel('public:link_clicks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'link_clicks' }, payload => {
        const newClick = payload.new;
        setLinks(prev =>
          prev.map(link =>
            link.id === newClick.link_id
              ? { ...link, click_count: (link.click_count || 0) + 1 }
              : link
          )
        );
      })
      .subscribe();

    return () => {
      clickChannel.unsubscribe();
    };
  }, []);

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Get theme from our custom hook
  const { theme, toggleTheme } = useThemeManager();

  // Render loading or redirect state if user is not checked yet
  if (!userChecked) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  // If user is null after check, don't render dashboard (redirect will already have happened)
  if (!user) {
    return null;
  }

  return (
    <>
      <NavMenu />
      <div className="dashboard-container max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-gray-800 sm:mb-8  p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div>
            <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">WELCOME BACK</div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Manage your shortened links and track performance</p>
          </div>
        <div className="flex gap-3">
          <button
            className="btn-accent"
            onClick={() => setProfileOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
            Profile
          </button>
        </div>
      </div>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 sm:mb-8">
        <div className="stat-card bg-white dark:bg-gray-800">
          <div className="stat-number">{allLinks.filter(l => !l.deleted).length}</div>
          <div className="stat-label text-gray-600 dark:text-gray-400">Active Links</div>
        </div>
        <div className="stat-card bg-white dark:bg-gray-800">
          <div className="stat-number">{totalClicks}</div>
          <div className="stat-label flex items-center">
            Qubits
            <div className="relative group ml-2">
              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-help">
                i
              </div>
              <div className="absolute z-10 invisible group-hover:visible bg-gray-800 text-white text-sm rounded-lg py-2 px-3 right-0 bottom-full mb-2 w-64 shadow-lg">
                Qubits are Supernova's currency - spend them on something in our shop.
                <div className="absolute top-full right-0 mr-3 -mt-1 border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card bg-white dark:bg-gray-800">
          <div className="stat-number">{allLinks.filter(l => l.deleted).length}</div>
          <div className="stat-label text-gray-600 dark:text-gray-400">Archived Links</div>
        </div>
      </div>
      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={() => setProfileOpen(false)}>
          <div className="modal-glass w-full max-w-md relative bg-white dark:bg-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">Profile Details</h2>
              <button 
                onClick={() => setProfileOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-2xl font-bold text-orange-500">
                {username ? username.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="border-b pb-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">Username</div>
                <div className="font-medium">{username || 'Not set'}</div>
              </div>
              <div className="border-b pb-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">Email</div>
                <div className="font-medium">{user?.email}</div>
              </div>
              <div className="border-b pb-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">Qubits</div>
                <div className="font-medium">{points}</div>
              </div>
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Content Creator</div>
                  <div className="text-xs text-gray-400">Enable if you are a content creator</div>
                </div>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${contentCreator ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={handleContentCreatorToggle}
                  type="button"
                  aria-pressed={contentCreator}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${contentCreator ? 'translate-x-6' : 'translate-x-1'}`}></span>
                </button>
              </div>
            </div>
            
            <button
              className="btn-accent w-full"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Create Link Form */}
     

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 items-center gap-2">
          <button
            className={`py-2 px-4 -mb-px text-sm font-medium focus:outline-none ${activeTab === 'active' ? 'border-b-2 border-orange-500 text-orange-500' : 'border-b-2 border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Links
          </button>
          <button
            className={`py-2 px-4 -mb-px text-sm font-medium focus:outline-none ${activeTab === 'archived' ? 'border-b-2 border-orange-500 text-orange-500' : 'border-b-2 border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('archived')}
          >
            Archived Links
          </button>
          <button
            className={`py-2 px-4 -mb-px text-sm font-medium focus:outline-none ${activeTab === 'all' ? 'border-b-2 border-orange-500 text-orange-500' : 'border-b-2 border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('all')}
          >
            All Links
          </button>
          <button
            className="ml-auto py-2 px-4 text-sm font-medium focus:outline-none border-b-2 border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
            onClick={() => fetchLinks()}
            aria-label="Refresh links"
            style={{height: '40px'}} // Ensures alignment with tab buttons
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
        </div>
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            placeholder="Search by title, creator, URL, or domain..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label htmlFor="domainFilter" className="text-sm font-medium text-gray-800 dark:text-gray-300">
              Filter by domain:
            </label>
            <select
              id="domainFilter"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full sm:w-auto"
            >
              {availableDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain === 'all' ? 'All Domains' : domain}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  if (sortBy === 'date') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('date');
                    setSortDirection('desc');
                  }
                }}
                className={`text-sm px-3 py-1 rounded flex items-center ${sortBy === 'date' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                aria-label={`Sort by date ${sortDirection === 'asc' ? 'oldest first' : 'newest first'}`}
              >
                Date
                {sortBy === 'date' && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    {sortDirection === 'asc' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75 7.5 12.75 4.5 9.75" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25-2.25 12.75 19.5 17.25" />
                    )}
                  </svg>
                )}
              </button>
              <button 
                onClick={() => {
                  if (sortBy === 'clicks') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('clicks');
                    setSortDirection('desc');
                  }
                }}
                className={`text-sm px-3 py-1 rounded flex items-center ${sortBy === 'clicks' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                aria-label={`Sort by clicks ${sortDirection === 'asc' ? 'lowest first' : 'highest first'}`}
              >
                Clicks
                {sortBy === 'clicks' && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    {sortDirection === 'asc' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75 7.5 12.75 4.5 9.75" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25-2.25 12.75 19.5 17.25" />
                    )}
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl font-bold">{activeTab === 'active' ? 'Your Links' : 'Archived Links'}</h2>
        </div>
        
        <div className="space-y-4">
          {filteredLinks.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-gray-600 dark:text-gray-400">No links found</div>
              {activeTab === 'archived' && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Links you archive will appear here
                </div>
              )}
              {domainFilter !== 'all' && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Try changing your domain filter
                </div>
              )}
            </div>
          ) : (
            filteredLinks.map(link => (
              <div key={link.ref_id || link.id} className="p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 relative hover:shadow-md transition-shadow">
                {/* Activity Icon */}
                <div className="absolute left-3 sm:left-4 top-3 sm:top-4 flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  {link.page_favicon && typeof link.page_favicon === 'string' ? (
                    <img 
                      src={link.page_favicon} 
                      alt="Favicon" 
                      className="w-4 h-4 rounded-full" 
                      onError={(e) => {
                        // If favicon fails to load, show default icon
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = 'none';
                        const nextElement = img.nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = 'block';
                        }
                      }}
                    />
                  ) : null}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth={1.5} 
                    stroke="currentColor" 
                    className="w-4 h-4 text-orange-500"
                    style={{ display: (link.page_favicon && typeof link.page_favicon === 'string') ? 'none' : 'block' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                
                <div className="pl-12">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {link.page_title && typeof link.page_title === 'string' && link.page_title !== 'Loading...' ? link.page_title : link.short_code}
                      </h3>
                      {/* Original creator username, clickable */}
                      {link.original_creator && link.original_creator.username && (
                        <div className="mt-1">
                          <Link
                            href={`/creator/${link.original_creator.id}`}
                            className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
                          >
                            @{link.original_creator.username} (original creator)
                          </Link>
                        </div>
                      )}
                      {/* Hide the URL with parameter if removed by creator */}
                      {!(link._linkType === 'ref' && link.removed_by_creator) && (
                        <a 
                          href={link._linkType === 'ref' && link.utm_param ? `${origin}/${link.short_code}?utm_ref=${link.utm_param}` : `${origin}/${link.short_code}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-orange-500 hover:text-orange-600"
                        >
                          {link._linkType === 'ref' && link.utm_param ? `${origin}/${link.short_code}?utm_ref=${link.utm_param}` : `${origin}/${link.short_code}`}
                        </a>
                      )}
                      {link._linkType === 'ref' ? (
                        <div className="flex items-center mb-2">
                          {link.page_favicon && (
                            <img src={link.page_favicon} alt="Favicon" className="h-5 w-5 mr-2 rounded" />
                          )}
                          <span className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate max-w-xs">
                            {link.page_title || link.original_url}
                          </span>
                          {activeTab === 'all' && (
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                              ${link._linkType === 'ref' && link.removed_by_creator ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                link._linkType === 'ref' && link.removed_by_user ? 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                link._linkType === 'original' && link.deleted ? 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}
                            `}>
                              {link._linkType === 'ref' && link.removed_by_creator ? 'Removed by Creator' :
                                link._linkType === 'ref' && link.removed_by_user ? 'Archived' :
                                link._linkType === 'original' && link.deleted ? 'Archived' :
                                'Active'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Your original link
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {link.created_at ? new Date(link.created_at).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  
                  {/* Preview Image */}
                  {link.page_image && typeof link.page_image === 'string' && link.page_image.trim() !== '' && (
                    <a 
                      href={link.original_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                      style={{ maxWidth: '200px' }}
                    >
                      <img 
                        src={link.page_image} 
                        alt="Preview" 
                        className="w-full h-auto object-contain" 
                        style={{ maxHeight: '120px' }}
                        onError={(e) => {
                          // Hide image if it fails to load
                          const img = e.currentTarget as HTMLImageElement;
                          const parent = img.parentElement;
                          if (parent) parent.style.display = 'none';
                        }}
                      />
                    </a>
                  )}
                  
                  {/* Description */}
                  {link.page_description && typeof link.page_description === 'string' && link.page_description.trim() !== '' && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {link.page_description}
                    </p>
                  )}
                  
                  {/* Chip for removed by creator (for reference links) */}
                  {link._linkType === 'ref' && link.removed_by_creator && (
                    <span className="inline-block bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded-full text-xs font-semibold mr-2 mb-2 relative group cursor-pointer">
  Removed by Creator
  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded shadow-lg z-50 px-3 py-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-x-transparent after:border-b-transparent after:border-t-gray-800">
    This link has been removed by the creator. You will no longer gain Qubits for clicks on this link.
  </span>
</span>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 break-all">
                    {link.original_url}
                  </div>
                  
                  {/* Click Count Badge */}
                  <div className="mt-4 flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 px-3 py-1 rounded-full flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                      </svg>
                      <span className="font-medium">{linkRefsClickCounts[link.id] || 0} clicks</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Refresh Metadata Button */}
                    <button
                      onClick={() => handleRefreshLinkMetadata(link.id)}
                      disabled={refreshingLinkIds.includes(link.id)}
                      className={`px-2 py-1 text-xs rounded-md flex items-center ${refreshingLinkIds.includes(link.id) ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800'}`}
                      aria-label="Refresh metadata for this link"
                    >
                      {refreshingLinkIds.includes(link.id) ? (
                        <>
                          <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh Metadata
                        </>
                      )}
                    </button>
                    
                    {/* Copy Button */}
                    <div className="relative group">
                      <button
                        className={`px-2 py-1 text-xs rounded-md flex items-center ${link._linkType === 'ref' && link.removed_by_creator ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                        onClick={async () => {
                          if (link._linkType === 'ref' && link.removed_by_creator) return;
                          const utmLink = origin && user?.id ? `${origin}/${link.short_code}?utm_ref=${user.id}` : `/${link.short_code}?utm_ref=${user?.id}`;
                          await navigator.clipboard.writeText(utmLink);
                          setCopiedLinkId(link.id);
                          setTimeout(() => setCopiedLinkId(null), 1200);
                        }}
                        aria-label="Copy shortened link with UTM param"
                        disabled={link._linkType === 'ref' && link.removed_by_creator}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75a2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 014 6.108H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                        </svg>
                        Copy Magic Link
                        {copiedLinkId === link.id && (
                          <span className="absolute ml-16 bg-gray-800 text-white text-xs rounded px-2 py-1 shadow z-30 whitespace-nowrap">
                            Copied!
                          </span>
                        )}
                      </button>
                      {/* Tooltip for removed by creator */}
                      {link._linkType === 'ref' && link.removed_by_creator && (
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded shadow-lg z-50 px-3 py-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-x-transparent after:border-b-transparent after:border-t-gray-800">
                          This link has been removed by the creator. Clicks on this link will no longer earn you Qubits. Your old link will still direct to the original URL.
                        </span>
                      )}
                    </div>
                    
                    {/* Stats Button */}
                    <button
                      onClick={() => router.push(`/links/${link.id}`)}
                      className="px-2 py-1 text-xs rounded-md flex items-center bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label="View link statistics"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                      View Stats
                    </button>
                    
                    {/* Delete/Restore Button */}
                    {(activeTab === 'active' || (activeTab === 'all' && (
                      (link._linkType === 'original' && !link.deleted) ||
                      (link._linkType === 'ref' && !link.removed_by_user)
                    ))) ? (
                      <div className="relative group">
                        <button
                          onClick={() => handleArchive(link.id, link.ref_id)}
                          className="px-2 py-1 text-xs rounded-md flex items-center bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                          aria-label="Archive link"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9-.346 9m4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Archive
                      </button>
                      <div className="absolute z-10 invisible group-hover:visible bg-gray-800 text-white text-xs rounded-lg py-2 px-3 left-0 bottom-full mb-2 w-64 shadow-lg">
                        Archiving your link will make it stop working. You will retain any Qubits earned from this link. You can restore links at any time.
                        <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                    ) : ((activeTab === 'archived' || (activeTab === 'all' && (
                      (link._linkType === 'original' && link.deleted) ||
                      (link._linkType === 'ref' && link.removed_by_user)
                    ))) && (
                      <button
                        onClick={() => handleRestore(link.id, link.ref_id, link._linkType)}
                        className="px-2 py-1 text-xs rounded-md flex items-center bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                        aria-label="Restore link"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        Restore
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </>
  );
}