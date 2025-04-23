"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'clicks'>('date');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [username, setUsername] = useState<string>('');
  const [totalClicks, setTotalClicks] = useState<number>(0);
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

  useEffect(() => {
    if (user) {
      fetchLinks();
      fetchPoints();
      fetchTotalClicks();
      fetchUsername();
    }
    // eslint-disable-next-line
  }, [user]);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
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
    const { data, error } = await supabase
      .from('links')
      .select('click_count', { count: 'exact' })
      .eq('user_id', user.id);
    if (!error && data) {
      const sum = data.reduce((acc, link) => acc + (link.click_count || 0), 0);
      setTotalClicks(sum);
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

  return (
    <div className="dashboard-container max-w-2xl mx-auto py-8 px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-lg">Dashboard</h1>
        <button
          className="btn-accent shadow-lg"
          onClick={() => setProfileOpen(true)}
        >
          Profile
        </button>
      </div>
      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="modal-glass min-w-[320px] relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setProfileOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-extrabold mb-4 text-center bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 text-transparent bg-clip-text">User Profile</h2>
            <div className="mb-2 flex gap-2 items-center justify-center">
              <span className="font-semibold">Username:</span>
              <span className="text-indigo-600 dark:text-indigo-300 font-mono">{username}</span>
            </div>
            <div className="mb-6 flex gap-2 items-center justify-center">
              <span className="font-semibold">Email:</span>
              <span className="text-cyan-600 dark:text-cyan-300 font-mono">{user?.email}</span>
            </div>
            <button
              className="btn-accent w-full mt-2"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Total Points Card */}
      <div className="mb-8">
        <div className="card-glass soft-shadow flex flex-col items-center text-center mb-2">
          <div className="font-bold text-xl bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-400 text-transparent bg-clip-text mb-1">Total Point Balance</div>
          <div className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-300 mb-1">{totalClicks}</div>
          <div className="text-sm text-gray-700 dark:text-gray-200">(Sum of all clicks on your shortened links)</div>
        </div>
      </div>
      <form className="flex gap-2 mb-10" onSubmit={handleCreate}>
        <input
          type="url"
          placeholder="Paste your link here"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border-none bg-white/60 dark:bg-zinc-900/60 shadow focus:outline-none focus:ring-2 focus:ring-accent"
          required
        />
        <button
          type="submit"
          className="btn-accent font-semibold disabled:opacity-60 shadow-lg"
          disabled={loading}
        >
          Shorten
        </button>
      </form>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-indigo-500 text-transparent bg-clip-text">Your Links</h2>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto mt-2 sm:mt-0">
            <select
              className="rounded-xl px-3 py-2 bg-white/80 dark:bg-zinc-900/60 border-none shadow focus:outline-none focus:ring-2 focus:ring-accent text-sm font-semibold"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'date' | 'clicks')}
            >
              <option value="date">Sort by Date</option>
              <option value="clicks">Sort by Clicks</option>
            </select>
            <button
              className="btn-accent px-5 py-2 font-semibold shadow-lg"
              onClick={fetchLinks}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>
        <ul className="space-y-4 w-full">
          {[...links].sort((a, b) => {
            if (sortBy === 'date') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else {
              return (b.click_count || 0) - (a.click_count || 0);
            }
          }).map(link => {
            const shortUrl = `${window.location.origin}/${link.short_code}`;
            return (
              <li key={link.id} className="card-glass soft-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center relative w-full">
                {/* Copy Icon Button */}
                <button
                  className="absolute top-3 right-3 p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-zinc-800 transition group z-20"
                  style={{top: 12, right: 12}}
                  title="Copy link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shortUrl);
                    setCopiedLinkId(link.id);
                    setTimeout(() => setCopiedLinkId(null), 1200);
                  }}
                  aria-label="Copy shortened link"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-indigo-500 group-hover:text-indigo-700 transition"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12H7.5A2.5 2.5 0 0 1 7.5 7h5A2.5 2.5 0 0 1 15 9.5V12m-6 0v2.5A2.5 2.5 0 0 0 11.5 17h5A2.5 2.5 0 0 0 19 14.5v-5A2.5 2.5 0 0 0 16.5 7H15m-6 5h6" />
                  </svg>
                  {copiedLinkId === link.id && (
                    <span className="absolute right-0 top-8 bg-indigo-600 text-white text-xs rounded px-2 py-1 shadow z-30 animate-fade-in-out whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
                <div>
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-lg"
                  >
                    {shortUrl}
                  </a>
                  <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">Original URL: <span className="font-mono break-all">{link.original_url}</span></div>
                  <div className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Clicks: <span className="font-bold">{link.click_count}</span></div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Created: {link.created_at ? new Date(link.created_at).toLocaleString() : 'N/A'}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
