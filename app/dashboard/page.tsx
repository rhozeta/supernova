"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'clicks'>('date');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    };
    getUser();
  }, [router]);

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // State for theme toggle
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Apply theme when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        // If no saved preference, check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      }
    }
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (user) {
      fetchLinks();
      fetchPoints();
      fetchTotalClicks();
      fetchUsername();
    }
    // eslint-disable-next-line
  }, [user, activeTab]);

  const fetchLinks = async () => {
    // First, fetch all links for stats
    const { data: allData, error: allError } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!allError) setAllLinks(allData || []);
    
    // Then, fetch filtered links for display based on active tab
    let query = supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id);
    
    // Filter by deleted status based on active tab
    if (activeTab === 'active') {
      query = query.eq('deleted', false);
    } else {
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

  const fetchPoints = async () => {
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
    // Generate a short code
    const short_code = Math.random().toString(36).substring(2, 8);
    console.log('Current user:', user);
    if (!user?.id) {
      alert('User ID is missing. Cannot create link.');
      setLoading(false);
      return;
    }
    const payload = {
      user_id: user.id,
      original_url: url,
      short_code,
      deleted: false,
    };
    console.log('Attempting to insert:', payload);
    const { error } = await supabase.from('links').insert(payload);
    setLoading(false);
    if (error) {
      console.error('Insert error:', error);
      alert('Failed to create link: ' + error.message);
    } else {
      console.log('Link created successfully!');
      setUrl('');
      fetchLinks();
    }
  };
  
  const handleDelete = async (linkId: string) => {
    // Mark the link as deleted instead of actually deleting it
    const { error } = await supabase
      .from('links')
      .update({ deleted: true })
      .eq('id', linkId);
      
    if (error) {
      console.error('Delete error:', error);
      alert('Failed to delete link: ' + error.message);
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

  return (
    <div className="dashboard-container max-w-5xl mx-auto py-8 px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <div>
          <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">WELCOME BACK</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Manage your shortened links and track performance</p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn-secondary"
            onClick={() => fetchLinks()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-number">{allLinks.filter(l => !l.deleted).length}</div>
          <div className="stat-label">Active Links</div>
        </div>
        <div className="stat-card">
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
        <div className="stat-card">
          <div className="stat-number">{allLinks.filter(l => l.deleted).length}</div>
          <div className="stat-label">Deleted Links</div>
        </div>
      </div>
      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={() => setProfileOpen(false)}>
          <div className="modal-glass min-w-[320px] relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Profile Details</h2>
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
                <div className="text-sm text-gray-500 dark:text-gray-400">Username</div>
                <div className="font-medium">{username || 'Not set'}</div>
              </div>
              <div className="border-b pb-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">Email</div>
                <div className="font-medium">{user?.email}</div>
              </div>
              <div className="border-b pb-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">Qubits</div>
                <div className="font-medium">{totalClicks}</div>
              </div>
              <div className="border-b pb-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">Theme</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  >
                    {theme === 'dark' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                      </svg>
                    )}
                  </button>
                </div>
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
        <form className="flex gap-3" onSubmit={handleCreate}>
          <input
            type="url"
            placeholder="Paste your link here"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
            required
          />
          <button
            type="submit"
            className="btn-accent font-semibold disabled:opacity-60"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            Shorten
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Tab Menu */}
        <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active
          </button>
          <button
            className={`tab-button ${activeTab === 'deleted' ? 'active' : ''}`}
            onClick={() => setActiveTab('deleted')}
          >
            Deleted
          </button>
        </div>
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {activeTab === 'active' ? 'Your Links' : 'Deleted Links'}
          </h2>
          <div className="flex items-center gap-3">
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 text-sm font-medium"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'date' | 'clicks')}
            >
              <option value="date">Sort by Date</option>
              <option value="clicks">Sort by Clicks</option>
            </select>
          </div>
        </div>
        <div className="space-y-4">
          {[...links].sort((a, b) => {
            if (sortBy === 'date') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else {
              return (b.click_count || 0) - (a.click_count || 0);
            }
          }).map(link => {
            const shortUrl = `${window.location.origin}/${link.short_code}`;
            return (
              <div key={link.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 relative">
                {/* Activity Icon */}
                <div className="absolute left-4 top-4 flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-orange-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                
                <div className="pl-12">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">{link.short_code}</h3>
                      <a 
                        href={shortUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-orange-500 hover:text-orange-600"
                      >
                        {shortUrl}
                      </a>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {link.created_at ? new Date(link.created_at).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 break-all">
                    {link.original_url}
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 text-blue-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
                        </svg>
                        <span className="text-sm font-medium">{link.click_count || 0} clicks</span>
                      </div>
                      
                      {activeTab === 'active' ? (
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                          aria-label="Delete link"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(link.id)}
                          className="text-sm text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center"
                          aria-label="Restore link"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                          </svg>
                          Restore
                        </button>
                      )}
                    </div>
                    
                    <button
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      title="Copy link"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shortUrl);
                        setCopiedLinkId(link.id);
                        setTimeout(() => setCopiedLinkId(null), 1200);
                      }}
                      aria-label="Copy shortened link"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                      </svg>
                      {copiedLinkId === link.id && (
                        <span className="absolute right-0 top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 shadow z-30 whitespace-nowrap">
                          Copied!
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {links.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {activeTab === 'active' ? 'No active links found. Create one above!' : 'No deleted links found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
