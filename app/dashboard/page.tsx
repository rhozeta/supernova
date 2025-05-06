"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';
import { useThemeManager } from '../../lib/useTheme';
import { fetchMetadata } from '../../lib/fetchMetadata';
import { updateAllUserLinkMetadata, updateLinkMetadata } from '../../lib/updateLinkMetadata';
import toast, { Toaster } from 'react-hot-toast';


interface Link {
  id: string;
  short_code: string;
  original_url: string;
  created_at: string;
  click_count: number;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
  };
  page_title?: string;
  page_description?: string;
  page_image?: string;
  page_favicon?: string;
  creator?: {
    id: string;
    username: string;
  };
  deleted: boolean;
}

export default function DashboardPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [allLinks, setAllLinks] = useState<Link[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'clicks'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [contentCreator, setContentCreator] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [origin, setOrigin] = useState('');

  // Helper to get short link with utm_ref param
  function getShortLinkWithUtm(short_code: string, user_id: string) {
    if (origin) {
      return `${origin}/${short_code}?utm_ref=${user_id}`;
    }
    return `/${short_code}?utm_ref=${user_id}`;
  }

  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'all'>('active');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    qubit_cost: 0
  });
  const router = useRouter();

  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLinks, setFilteredLinks] = useState<Link[]>(links);
  
  // Filter links based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLinks(links);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = links.filter(link => {
        const pageTitle = (link.page_title || link.metadata?.title || '').toLowerCase();
        const originalUrl = (link.original_url || '').toLowerCase();
        const shortCode = (link.short_code || '').toLowerCase();
        const description = (link.metadata?.description || '').toLowerCase();
        
        return (
          pageTitle.includes(term) ||
          originalUrl.includes(term) ||
          shortCode.includes(term) ||
          description.includes(term)
        );
      });
      setFilteredLinks(filtered);
    }
  }, [searchTerm, links]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      // Check content creator status
      const { data } = await supabase
        .from('profiles')
        .select('content_creator')
        .eq('id', user.id)
        .single();
      if (!data?.content_creator) {
        router.replace('/dashboard-user');
        return;
      }
      setContentCreator(true);
      setCheckingStatus(false);
    };
    getUser();
  }, [router]);

  // Logout function
  const handleLogout = async () => {

  // If still checking, render nothing (or a spinner)
  if (checkingStatus) {
    return null; // Or a spinner
  }

    await supabase.auth.signOut();
    router.push('/login');
  };

  // Get theme from our custom hook
  const { theme, toggleTheme } = useThemeManager();

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
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('content_creator')
      .eq('id', user.id)
      .single();
    if (!error && data) setContentCreator(data.content_creator);
  };

  // Update content creator status
  const handleContentCreatorToggle = async () => {
    if (!user?.id) return;
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
  }, [activeTab]);

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

  // Apply domain filter and sorting to links (no deleted filter here)
  useEffect(() => {
    if (links.length > 0) {
      let result = [...links];
      // Apply domain filter if not 'all'
      if (domainFilter !== 'all') {
        result = result.filter(link => extractDomain(link.original_url) === domainFilter);
      }
      // Apply sorting
      if (sortBy === 'date') {
        result.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
      } else if (sortBy === 'clicks') {
        result.sort((a, b) => {
          const clicksA = a.click_count || 0;
          const clicksB = b.click_count || 0;
          return sortDirection === 'desc' ? clicksB - clicksA : clicksA - clicksB;
        });
      }
      setFilteredLinks(result);
    } else {
      setFilteredLinks([]);
    }
  }, [links, domainFilter, sortBy, sortDirection]);

  const fetchLinks = async () => {
    if (!user?.id) return;
    // First, fetch all links for stats
    const { data: allData, error: allError } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!allError) {
      setAllLinks(allData || []);
      updateAvailableDomains(allData || []);
    }
    
    // Then, fetch filtered links for display based on active tab
    let query = supabase
      .from('links')
      .select('*, creator:creator_id(id,username)')
      .eq('user_id', user.id);
    
    // Filter by deleted status based on active tab
    if (activeTab === 'active') {
      query = query.eq('deleted', false);
    } else if (activeTab === 'archived') {
      query = query.eq('deleted', true);
    }
    
    // Execute query with ordering
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (!error) setLinks(data || []);
    // Also refresh total clicks when links are refreshed
    fetchTotalClicks();
  };

  // Fetch the username from profiles table
  const fetchUsername = async () => {
    if (!user?.id) return;
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
    if (!user?.id) return;
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
    if (!user?.id) return;
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
      
      if (!user?.id) {
        alert('User ID is missing. Cannot create link.');
        setLoading(false);
        return;
      }
      
      // Show loading state in UI
      setLinks(prevLinks => [
        {
          id: 'temp-' + Date.now(),
          user_id: user.id,
          original_url: formattedUrl,
          short_code,
          deleted: false,
          created_at: new Date().toISOString(),
          page_title: 'Loading metadata...',
          page_description: 'Fetching page information...',
          page_image: '',
          page_favicon: '',
          click_count: 0,
          isLoading: true
        },
        ...prevLinks
      ]);
      
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
  
  const handleArchive = async (linkId: string) => {
    // Mark the link as archived instead of actually deleting it
    const { error } = await supabase
      .from('links')
      .update({ deleted: true })
      .eq('id', linkId);
      
    if (error) {
      console.error('Archive error:', error);
      alert('Failed to archive link: ' + error.message);
    } else {
      // Refresh the links list and points
      fetchLinks();
      fetchPoints();
    }
  };
  
  const handleRestore = async (linkId: string) => {
    // Restore a deleted link
    const { error } = await supabase
      .from('links')
      .update({ deleted: false })
      .eq('id', linkId);
      
    if (error) {
      console.error('Restore error:', error);
      alert('Failed to restore link: ' + error.message);
    } else {
      // Refresh the links list and points
      fetchLinks();
      fetchPoints();
    }
  };

  // Function to refresh metadata for all user links
  const handleRefreshAllMetadata = async () => {
    if (!user?.id) return;
    
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

  // Fetch rewards created by this user
  const fetchRewards = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards(data || []);
    } catch (err: any) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoadingRewards(false);
    }
  };

  // Handle reward creation
  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('rewards')
        .insert([
          {
            creator_id: user.id,
            title: newReward.title,
            description: newReward.description,
            qubit_cost: newReward.qubit_cost,
            active: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setRewards([data, ...rewards]);
      setShowRewardModal(false);
      setNewReward({ title: '', description: '', qubit_cost: 0 });
      toast.success('Reward created successfully!');
    } catch (err: any) {
      console.error('Error creating reward:', err);
      toast.error('Failed to create reward. Please try again.');
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [activeTab, domainFilter, sortBy, sortDirection]);

  useEffect(() => {
    if (user?.id) {
      fetchRewards();
    }
  }, [user?.id]);

  return (
  <>
    <Toaster position="bottom-right" />
    <div className="dashboard-container max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">WELCOME BACK</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Creator Dashboard</h1>
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

      {/* Rewards Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 sm:mb-8 border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create rewards for your followers to redeem with their Qubits</p>
          </div>
          <button
            onClick={() => setShowRewardModal(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Reward
          </button>
        </div>
        
        {loadingRewards ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No rewards created yet. Create your first reward to engage with your followers!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div key={reward.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{reward.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{reward.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{reward.qubit_cost} Qubits</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${reward.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {reward.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
              <h2 className="text-xl font-bold">Profile Details</h2>
              <button 
                onClick={() => setProfileOpen(false)}
                className="text-gray-400 hover:text-gray-600"
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
                  aria-pressed={contentCreator ?? undefined}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Create New Link</h2>
        {contentCreator && (
          <form onSubmit={handleCreate} className="flex gap-2 mb-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white"
              placeholder="Paste a long URL to shorten..."
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-60"
            >
              {loading ? 'Shortening...' : 'Shorten'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            className={`py-2 px-4 font-medium flex items-center gap-2 ${activeTab === 'active' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Links
            <span className="ml-1 inline-block min-w-[1.5em] px-1 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold dark:bg-orange-900 dark:text-orange-200">{allLinks.filter(l => !l.deleted).length}</span>
          </button>
          <button
            className={`py-2 px-4 font-medium flex items-center gap-2 ${activeTab === 'archived' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('archived')}
          >
            Archived Links
            <span className="ml-1 inline-block min-w-[1.5em] px-1 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold dark:bg-gray-700 dark:text-gray-300">{allLinks.filter(l => l.deleted).length}</span>
          </button>
          <button
            className={`py-2 px-4 font-medium flex items-center gap-2 ${activeTab === 'all' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('all')}
          >
            All Links
            <span className="ml-1 inline-block min-w-[1.5em] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold dark:bg-blue-900 dark:text-blue-200">{allLinks.length}</span>
          </button>
          <button
            className="ml-auto py-2 px-4 text-sm font-medium focus:outline-none border-b-2 border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
            onClick={() => fetchLinks()}
            aria-label="Refresh links"
            style={{height: '40px'}} // Ensures alignment with tab buttons
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block">
  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5A9 9 0 1 1 12 21v-3m0 3l-3-3m3 3l3-3" />
</svg>
            Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search links..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
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
          <h2 className="text-xl font-bold">{activeTab === 'active' ? 'Your Links' : activeTab === 'archived' ? 'Archived Links' : 'All Links'}</h2>
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
              <div key={link.id} className="p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 relative hover:shadow-md transition-shadow">
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 1-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 1 1.242 7.244" />
                  </svg>
                </div>
                
                <div className="pl-12">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {link.page_title && typeof link.page_title === 'string' && link.page_title !== 'Loading...' ? link.page_title : link.short_code}
                      </h3>
                      {/* Owner username, clickable */}
                      {link.creator && link.creator.username && (
                        <Link
                          href={`/profile/${link.creator.id}`}
                          className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium ml-1"
                        >
                          @{link.creator.username}
                        </Link>
                      )}
                      <a 
                        href={`${origin}/${link.short_code}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-orange-500 hover:text-orange-600"
                      >
                        {origin}/{link.short_code}
                      </a>
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
                  
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 break-all">
                    {link.original_url}
                  </div>
                  
                  {/* Click Count Badge */}
                  <div className="mt-4 flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 px-3 py-1 rounded-full flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                      </svg>
                      <span className="font-medium">{link.click_count || 0} clicks</span>
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
                    <button
                      className="px-2 py-1 text-xs rounded-md flex items-center bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={async () => {
                        const utmLink = origin && user?.id ? `${origin}/${link.short_code}?utm_ref=${user.id}` : `/${link.short_code}?utm_ref=${user?.id}`;
                        await navigator.clipboard.writeText(utmLink);
                        setCopiedLinkId(link.id);
                        setTimeout(() => setCopiedLinkId(null), 1200);
                      }}
                      aria-label="Copy shortened link with UTM param"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75a2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 014 6.108H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                      </svg>
                      </svg>
                      Copy Link
                      {copiedLinkId === link.id && (
                        <span className="absolute ml-16 bg-gray-800 text-white text-xs rounded px-2 py-1 shadow z-30 whitespace-nowrap">
                          Copied!
                        </span>
                      )}
                    </button>
                    
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
                    {activeTab === 'active' ? (
                      <div className="relative group">
                        <button
                          onClick={() => handleArchive(link.id)}
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
                    ) : (
                      <button
                        onClick={() => handleRestore(link.id)}
                        className="px-2 py-1 text-xs rounded-md flex items-center bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                        aria-label="Restore link"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

    {/* Add Reward Modal */}
    {showRewardModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Reward</h3>
          <form onSubmit={handleCreateReward}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={newReward.title}
                onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={newReward.description}
                onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[100px]"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qubit Cost</label>
              <input
                type="number"
                min="1"
                value={newReward.qubit_cost}
                onChange={(e) => setNewReward({ ...newReward, qubit_cost: parseInt(e.target.value) || 0 })}
                className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Create Reward
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
  );
}