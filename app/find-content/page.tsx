"use client";

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import NavMenu from "../components/NavMenu";

export default function FindContentPage() {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New state for followed creators' latest links
  interface Link {
    id: string;
    original_url: string;
    page_title?: string;
    page_image?: string;
    page_favicon?: string;
    click_count?: number;
    created_at: string;
    // Add more fields if needed
  }

  const [followedLinks, setFollowedLinks] = useState<Record<string, Link[]>>({});
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [followedError, setFollowedError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch creators for search
  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("content_creator", true)
        .order("username", { ascending: true });
      if (error) setError("Error loading creators");
      else setCreators(data || []);
      setLoading(false);
    };
    fetchCreators();
  }, []);

  const filtered = creators.filter(
    c =>
      (c.username || "")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  // Fetch current user and followed creators' latest links
  useEffect(() => {
    async function fetchFollowedLinks() {
      setLoadingFollowed(true);
      setFollowedError("");
      try {
        // Get current user
        const { data: sessionData } = await supabase.auth.getUser();
        const userId = sessionData?.user?.id;
        setCurrentUserId(userId || null);
        if (!userId) {
          setFollowedLinks({});
          setLoadingFollowed(false);
          return;
        }
        // Get followed creators
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('creator_id, creator:creator_id(id, username)')
          .eq('follower_id', userId);
        if (followsError) throw followsError;
        if (!follows || follows.length === 0) {
          setFollowedLinks({});
          setLoadingFollowed(false);
          return;
        }
        // Fetch latest 3 links for each followed creator
        const linksByCreator: any = {};
        await Promise.all(
          follows.map(async (f: any) => {
            const creatorId = f.creator_id;
            const creatorUsername = f.creator?.username || 'Unknown';
            const { data: links, error: linksError } = await supabase
              .from('links')
              .select('id, original_url, page_title, page_image, page_favicon, click_count, created_at')
              .eq('user_id', creatorId)
              .eq('deleted', false)
              .order('created_at', { ascending: false })
              .limit(3);
            // Type assertion for links
            const typedLinks = links as Link[] | null;
            if (!linksError && typedLinks && typedLinks.length > 0) {
              linksByCreator[creatorUsername] = typedLinks;
            }
          })
        );
        setFollowedLinks(linksByCreator);
      } catch (err: any) {
        setFollowedError('Failed to load latest links from followed creators.');
      } finally {
        setLoadingFollowed(false);
      }
    }
    fetchFollowedLinks();
  }, []);

  return (
    <>
      <NavMenu />
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-4">Find Content</h1>
        <input
          type="text"
          placeholder="Search creators by username or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white mb-6 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400">Loading creators...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">No creators found.</div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(creator => (
              <li key={creator.id}>
                <Link
                  href={`/creator/${creator.id}`}
                  className="block bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-100 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900 transition-colors"
                >
                  <span className="font-medium text-orange-600 dark:text-orange-400">{creator.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Latest Links by Followed Creators Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Latest Links from Creators You Follow</h2>
          {loadingFollowed ? (
            <div className="text-gray-500 dark:text-gray-400">Loading latest links...</div>
          ) : followedError ? (
            <div className="text-red-500">{followedError}</div>
          ) : Object.keys(followedLinks).length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">No recent links from followed creators.</div>
          ) : (
            <div className="space-y-8">
              {Object.entries(followedLinks).map(([username, links]) => (
                <div key={username}>
                  <h3 className="text-xl font-semibold mb-3 text-orange-700 dark:text-orange-400">{username}</h3>
                  <ul className="space-y-3">
                    {(links as Link[]).map((link: Link) => (
                      <li key={link.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
                        <div className="flex-shrink-0 w-14 h-14 rounded bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                          {link.page_image ? (
                            <img src={link.page_image} alt={link.page_title || 'Link'} className="w-full h-full object-cover rounded" />
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600 text-2xl">🔗</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {link.page_favicon && typeof link.page_favicon === 'string' && (
                              <img src={link.page_favicon} alt="Favicon" className="w-4 h-4 rounded-full" />
                            )}
                            <span className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">{link.page_title || link.original_url}</span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">{link.original_url}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5m-5 0a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2zm-5 4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z" />
                            </svg>
                            {link.click_count || 0} clicks
                          </span>
                          <a href={link.original_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline">Visit</a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
