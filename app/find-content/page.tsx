"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import toast, { Toaster } from 'react-hot-toast';

// Add styles to hide scrollbar
const scrollbarHideStyles = {
  msOverflowStyle: 'none',  /* IE and Edge */
  scrollbarWidth: 'none',    /* Firefox */
  '&::-webkit-scrollbar': {  /* Chrome, Safari and Opera */
    display: 'none'
  }
} as const;

export default function FindContentPage() {
  // User state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userExistingLinks, setUserExistingLinks] = useState<Set<string>>(new Set());
  const [archivedLinks, setArchivedLinks] = useState<Set<string>>(new Set());

  // Creator search state
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Trending links state
  const [trendingLinks, setTrendingLinks] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [trendingError, setTrendingError] = useState("");
  const [addingLinkId, setAddingLinkId] = useState<string | null>(null);

  // Followed links state
  interface Link {
    id: string;
    original_url: string;
    page_title?: string;
    page_image?: string;
    page_favicon?: string;
    click_count?: number;
    created_at: string;
    user_id: string;
    creator_username?: string;
    short_code?: string;
    // Add more fields if needed
  }

  const [followedLinks, setFollowedLinks] = useState<Record<string, Link[]>>({});
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [followedError, setFollowedError] = useState("");

  // Fetch user's existing and archived links
  useEffect(() => {
    async function fetchUserLinks() {
      if (!currentUserId) return;

      // Fetch active links
      const { data: activeData, error: activeError } = await supabase
        .from('link_refs')
        .select('original_link_id')
        .eq('user_id', currentUserId)
        .eq('removed_by_user', false);

      // Fetch archived links
      const { data: archivedData, error: archivedError } = await supabase
        .from('link_refs')
        .select('original_link_id')
        .eq('user_id', currentUserId)
        .eq('removed_by_user', true);

      if (!activeError && activeData) {
        const activeLinkIds = new Set(activeData.map(ref => ref.original_link_id));
        setUserExistingLinks(activeLinkIds);
      }

      if (!archivedError && archivedData) {
        const archivedLinkIds = new Set(archivedData.map(ref => ref.original_link_id));
        setArchivedLinks(archivedLinkIds);
      }
    }

    fetchUserLinks();
  }, [currentUserId]);

  // Fetch trending links
  useEffect(() => {
    async function fetchTrendingLinks() {
      setLoadingTrending(true);
      setTrendingError("");
      try {
        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get links with their click counts and creator info from the last 7 days
        // Get all clicks in the last 7 days
        const { data: clickData, error: clickError } = await supabase
          .from('link_clicks')
          .select('link_id, clicked_at')
          .gte('clicked_at', sevenDaysAgo.toISOString());

        if (clickError) throw clickError;

        // Count clicks per link
        const clickCounts = clickData?.reduce((acc: Record<string, number>, click) => {
          acc[click.link_id] = (acc[click.link_id] || 0) + 1;
          return acc;
        }, {}) || {};

        // Get top 10 link IDs by click count
        const topLinkIds = Object.entries(clickCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([linkId]) => linkId);

        if (topLinkIds.length === 0) {
          setTrendingLinks([]);
          return;
        }

        // Fetch the actual link data for these IDs
        const { data: linksData, error: linksError } = await supabase
          .from('links')
          .select(`
            id,
            original_url,
            page_title,
            page_image,
            page_favicon,
            user_id,
            profiles!user_id (username),
            short_code
          `)
          .in('id', topLinkIds)
          .eq('deleted', false)
          .eq('profiles.content_creator', true);

        if (error) throw error;

        // Transform the data to match our Link interface
        if (linksError) throw linksError;

        // Transform and sort the links by their click count
        const transformedLinks = linksData?.map((link: any) => ({
          id: link.id,
          original_url: link.original_url,
          page_title: link.page_title,
          page_image: link.page_image,
          page_favicon: link.page_favicon,
          click_count: clickCounts[link.id],
          user_id: link.user_id,
          creator_username: link.profiles?.username,
          short_code: link.short_code,
        })) || [];

        setTrendingLinks(transformedLinks);
      } catch (err: any) {
        console.error('Error fetching trending links:', err); // Log the error object directly for better debugging
        setTrendingError('Failed to load trending links');
      } finally {
        setLoadingTrending(false);
      }
    }

    fetchTrendingLinks();
  }, []);

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
              .select('id, original_url, page_title, page_image, page_favicon, click_count, created_at, short_code')
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
        console.error('Error fetching followed links:', err); // Log the error object directly for better debugging
        setFollowedError('Failed to load latest links from followed creators.');
      } finally {
        setLoadingFollowed(false);
      }
    }
    fetchFollowedLinks();
  }, []);

  const unarchiveLink = async (link: Link) => {
    if (!currentUserId) {
      toast.error('Please log in to unarchive links');
      return;
    }

    try {
      setAddingLinkId(link.id);

      // Update the link_ref to set removed_by_user to false
      const { error: updateError } = await supabase
        .from('link_refs')
        .update({ removed_by_user: false })
        .eq('user_id', currentUserId)
        .eq('original_link_id', link.id);

      if (updateError) throw updateError;

      // Update local state
      setArchivedLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(link.id);
        return newSet;
      });
      setUserExistingLinks(prev => new Set([...prev, link.id]));

      toast.success(`Unarchived "${link.page_title || 'Link'}"!`, {
        duration: 3000,
        icon: '✨'
      });
    } catch (err) {
      console.error('Error unarchiving link:', err);
      toast.error('Failed to unarchive link. Please try again.');
    } finally {
      setAddingLinkId(null);
    }
  };

  const createLinkRef = async (link: Link) => {
    if (!currentUserId) {
      toast.error('Please log in to add links');
      return;
    }

    if (userExistingLinks.has(link.id)) {
      toast('This link is already in your dashboard', {
        icon: 'ℹ️',
        duration: 2000
      });
      return;
    }

    try {
      setAddingLinkId(link.id);

      // Create new link_ref
      const { error: insertError } = await supabase
        .from('link_refs')
        .insert({
          user_id: currentUserId,
          original_link_id: link.id,
          click_count: 0,
          removed_by_user: false
        });

      if (insertError) throw insertError;

      // Update local state
      setUserExistingLinks(prev => new Set([...prev, link.id]));
      toast.success(`Added "${link.page_title || 'Link'}" to your dashboard!`, {
        duration: 3000,
        icon: '✨'
      });
    } catch (err) {
      console.error('Error adding link:', err);
      toast.error('Failed to add link. Please try again.');
    } finally {
      setAddingLinkId(null);
    }
  };

  return (
    // Add horizontal padding back px-4 sm:px-6 lg:px-8
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <Toaster position="bottom-right" />
     
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Find Content</h2>
        <div className="relative">
          <div className="relative mt-4 mb-8">
            <input
              type="text"
              placeholder="Search creators..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            />
            {search && showResults && (
              <div 
                className="absolute z-30 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                onMouseDown={(e) => e.preventDefault()} // Prevent blur from hiding results before click
              >
                {loading ? (
                  <div className="p-4 text-gray-500 dark:text-gray-400">Loading creators...</div>
                ) : error ? (
                  <div className="p-4 text-red-500">{error}</div>
                ) : filtered.length === 0 ? (
                  <div className="p-4 text-gray-500 dark:text-gray-400">No creators found</div>
                ) : (
                  <ul className="py-2">
                    {filtered.map(creator => (
                      <li key={creator.id}>
                        <Link
                          href={`/creator/${creator.username}`}
                          className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/50 transition-colors font-medium text-orange-600 dark:text-orange-400"
                          onClick={() => setShowResults(false)}
                        >
                          @{creator.username}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {showResults && (
              <div
                onClick={() => setShowResults(false)}
                className="fixed inset-0 z-20"
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8"> 
          {/* Trending Links Carousel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Trending Links</h2>
            {loadingTrending ? (
              <div className="text-gray-500 dark:text-gray-400">Loading trending links...</div>
            ) : trendingError ? (
              <div className="text-red-500">{trendingError}</div>
            ) : trendingLinks.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">No trending links found.</div>
            ) : (
              <div className="relative">
                <div 
                  className="flex gap-4 overflow-x-auto pb-4" 
                  style={scrollbarHideStyles}
                  id="trending-carousel"
                >
                  {trendingLinks.map((link: Link) => (
                    <div key={link.id} className="flex-none w-72">
                      <div key={link.id} className="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        {/* Card Header - Image */}
                        <div className="relative w-full pt-[56.25%] bg-gray-100 dark:bg-gray-900">
                          {link.page_image ? (
                            <img 
                              src={link.page_image} 
                              alt={link.page_title || 'Link'} 
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-4xl">🔥</span>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-black/50 text-white backdrop-blur-sm">
                              {link.click_count} clicks
                            </span>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="flex-1 p-4">
                          <div className="flex items-start gap-2 mb-2">
                            {link.page_favicon && typeof link.page_favicon === 'string' && (
                              <img src={link.page_favicon} alt="Favicon" className="w-4 h-4 rounded-full flex-shrink-0 mt-1" />
                            )}
                            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                              {link.page_title || link.original_url}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                            {link.original_url}
                          </p>
                          <div className="text-sm text-orange-600 dark:text-orange-400">
                            By {link.creator_username ? (
                              <Link href={`/creator/${link.creator_username}`} className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300">
                                @{link.creator_username}
                              </Link>
                            ) : 'unknown'}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="p-4 pt-0 flex items-center justify-between gap-2 mt-auto">
                          <a 
                            href={`/s/${link.short_code}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Visit Link →
                          </a>
                          <div className="relative group">
                            <button
                              onClick={() => archivedLinks.has(link.id) ? unarchiveLink(link) : createLinkRef(link)}
                              disabled={addingLinkId === link.id || userExistingLinks.has(link.id)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg ${addingLinkId === link.id || userExistingLinks.has(link.id)
                                ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                : archivedLinks.has(link.id)
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100 dark:hover:bg-orange-800'
                              } transition-colors`}
                            >
                              {addingLinkId === link.id 
                                ? archivedLinks.has(link.id) ? 'Unarchiving...' : 'Adding...' 
                                : userExistingLinks.has(link.id) 
                                ? 'Added' 
                                : archivedLinks.has(link.id) 
                                ? 'Unarchive' 
                                : 'Add Link'
                              }
                            </button>
                            {userExistingLinks.has(link.id) && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                This link has already been added to your dashboard
                              </div>
                            )}
                            {archivedLinks.has(link.id) && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                Click to move this link back to your active links
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Followed Creators Links Carousel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Links from Creators You Follow</h2>
            {loadingFollowed ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              </div>
            ) : followedError ? (
              <div className="text-red-500">{followedError}</div>
            ) : Object.keys(followedLinks).length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">No recent links from followed creators.</div>
            ) : (
              <div className="relative">
                <div 
                  className="flex gap-4 overflow-x-auto pb-4" 
                  style={scrollbarHideStyles}
                  id="followed-carousel"
                >
                  {Object.entries(followedLinks).map(([username, links]) => (
                    <div key={username} className="flex-none w-72">
                      <div key={username} className="col-span-1">
                        <Link href={`/creator/${username}`} className="text-xl font-semibold mb-3 text-orange-700 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 block">@{username}</Link>
                        <ul className="space-y-3">
                          {(links as Link[]).map((link: Link) => (
                            <li key={link.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
                              {/* Group Favicon and Title */}
                              <div className="flex items-center gap-3 mb-3">
                                {link.page_favicon && typeof link.page_favicon === 'string' && (
                                  <img src={link.page_favicon} alt="Favicon" className="w-5 h-5 rounded-full flex-shrink-0" />
                                )}
                                <span className="font-semibold text-gray-900 dark:text-white" title={link.page_title || link.original_url}>{link.page_title || link.original_url}</span>
                              </div>
                              {/* Group Buttons below title/favicon */}
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/s/${link.short_code}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/50"
                                  title="Visit Original Link"
                                >
                                  Visit
                                </a>
                                <div className="relative group">
                                  <button
                                    onClick={() => archivedLinks.has(link.id) ? unarchiveLink(link) : createLinkRef(link)}
                                    disabled={addingLinkId === link.id || userExistingLinks.has(link.id)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg ${addingLinkId === link.id || userExistingLinks.has(link.id)
                                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                      : archivedLinks.has(link.id)
                                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800'
                                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100 dark:hover:bg-orange-800'
                                    } transition-colors`}
                                  >
                                    {addingLinkId === link.id
                                      ? archivedLinks.has(link.id) ? 'Unarchiving...' : 'Adding...'
                                      : userExistingLinks.has(link.id)
                                      ? 'Added'
                                      : archivedLinks.has(link.id)
                                      ? 'Unarchive'
                                      : 'Add Link'
                                    }
                                  </button>
                                  {userExistingLinks.has(link.id) && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      This link has already been added to your dashboard
                                    </div>
                                  )}
                                  {archivedLinks.has(link.id) && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      Click to move this link back to your active links
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
