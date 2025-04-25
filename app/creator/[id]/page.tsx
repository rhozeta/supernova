"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import NavMenu from "../../components/NavMenu";


function AddToMyLinksButton({ link, currentUserId }: { link: any, currentUserId: string }) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user already has this link in link_refs (by original_link_id)
    async function checkIfAdded() {
      const { data, error } = await supabase
        .from('link_refs')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('original_link_id', link.id)
        .maybeSingle();
      setAdded(!!data && !error);
    }
    checkIfAdded();
    // eslint-disable-next-line
  }, [link, currentUserId]);

  const handleAdd = async () => {
    setLoading(true);
    setError("");
    // Generate a short code for this user's reference
    const short_code = Math.random().toString(36).substring(2, 8);
    // Generate UTM param as user_id
    const utm_param = currentUserId;
    // Insert into link_refs, relating to the original link
    const { error } = await supabase.from('link_refs').insert({
      user_id: currentUserId,
      original_link_id: link.id,
      original_url: link.original_url,
      short_code,
      utm_param,
      page_title: link.page_title,
      page_image: link.page_image,
      page_favicon: link.page_favicon,
      page_description: link.page_description
    });
    setLoading(false);
    if (!error) {
      setSuccess(true);
      setAdded(true);
    } else {
      setError("Error adding link");
    }
  };

  if (added) {
    return <button disabled className="px-2 py-1 text-xs rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 cursor-not-allowed">Added</button>;
  }
  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 font-semibold"
    >
      {loading ? 'Adding...' : success ? 'Added!' : 'Add to My Links'}
    </button>
  );
}

// Helper to generate a short link with utm_ref param
function getShortLinkWithUtm(short_code: string, user_id: string) {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/${short_code}?utm_ref=${user_id}`;
  }
  return `/${short_code}?utm_ref=${user_id}`;
}

export default function CreatorProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const [profile, setProfile] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [unfollowError, setUnfollowError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user id for follow logic
    const getCurrentUser = async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      setCurrentUserId(sessionData?.user?.id || null);
    };
    getCurrentUser();

    const fetchProfileAndLinks = async () => {
      setLoading(true);
      setError("");
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", id)
        .single();
      if (profileError || !profileData) {
        setError("Creator not found");
        setLoading(false);
        return;
      }
      setProfile(profileData);
      // Fetch links
      const { data: linksData, error: linksError } = await supabase
        .from("links")
        .select("id, original_url, created_at, page_title, page_image, page_favicon, page_description, click_count, short_code")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (linksError) setError("Error loading links");
      setLinks(linksData || []);
      setLoading(false);
    };
    if (id) {
      fetchProfileAndLinks();
      // Check follow status
      const checkFollowing = async () => {
        if (!currentUserId || !id || currentUserId === id) return;
        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('creator_id', id)
          .maybeSingle();
        setIsFollowing(!!data && !error);
      };
      checkFollowing();
    }
  }, [id, currentUserId]);

  // Unfollow handler
  async function handleUnfollow() {
    setLoadingFollow(true);
    setUnfollowError("");
    if (!currentUserId || !id) {
      setUnfollowError("User not found");
      setLoadingFollow(false);
      return;
    }
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('creator_id', id);
    setLoadingFollow(false);
    if (!error) {
      setIsFollowing(false);
    } else {
      setUnfollowError("Error unfollowing creator");
    }
  }

  const handleFollow = async () => {
    setLoadingFollow(true);
    const { data: sessionData } = await supabase.auth.getUser();
    const followerId = sessionData?.user?.id;
    if (!followerId || followerId === id) return;
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, creator_id: id });
    if (!error) setIsFollowing(true);
    setLoadingFollow(false);
  };

  if (loading) return <div className="max-w-2xl mx-auto py-12 px-4 text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="max-w-2xl mx-auto py-12 px-4 text-red-500">{error}</div>;

  return (
    <>
    <NavMenu></NavMenu>
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">{profile.username}</h1>
      {isFollowing && currentUserId && currentUserId !== id && (
        <span className="inline-block mb-2 px-3 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">Following</span>
      )}
      <div className="text-gray-500 dark:text-gray-400 mb-6">Content Creator</div>
      {/* Follow/Unfollow button logic */}
      {currentUserId && currentUserId !== id && (
        isFollowing ? (
          <button
            onClick={handleUnfollow}
            disabled={loadingFollow}
            className="px-4 py-2 rounded-md font-semibold text-white bg-gray-400 hover:bg-gray-500"
          >
            {loadingFollow ? 'Unfollowing...' : 'Unfollow'}
          </button>
        ) : (
          <button
            onClick={handleFollow}
            disabled={loadingFollow}
            className="px-4 py-2 rounded-md font-semibold text-white bg-orange-500 hover:bg-orange-600"
          >
            {loadingFollow ? 'Following...' : 'Follow'}
          </button>
        )
      )}
      {unfollowError && (
        <div className="text-red-500 mt-2">{unfollowError}</div>
      )}
      <h2 className="text-xl font-bold mb-4">Links by this Creator</h2>
      {links.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400">No links found.</div>
      ) : (
        <ul className="space-y-4">
          {links.map(link => (
            <li key={link.id} className="p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 relative hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {link.page_image ? (
                    <img src={link.page_image} alt={link.page_title || 'Link'} className="w-full h-full object-cover rounded-lg" />
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
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">{link.page_description}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/${link.short_code}`);
                      setCopiedLinkId(link.id);
                      setTimeout(() => setCopiedLinkId(null), 1200);
                    }}
                    className="px-2 py-1 text-xs rounded-md flex items-center bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    aria-label="Copy link"
                    type="button"
                  >
                    {copiedLinkId === link.id ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 mr-1 text-green-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15.75h-1.5A2.25 2.25 0 0 1 4.5 13.5v-6A2.25 2.25 0 0 1 6.75 5.25h6A2.25 2.25 0 0 1 15 7.5v1.5m-6.75 10.5h6A2.25 2.25 0 0 0 16.5 17.25v-6A2.25 2.25 0 0 0 14.25 9h-6A2.25 2.25 0 0 0 6 11.25v6A2.25 2.25 0 0 0 8.25 19.5Z" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5m-5 0a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2zm-5 4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z" />
                    </svg>
                    {link.click_count || 0} clicks
                  </span>
                  {/* Add to My Links button */}
                  {currentUserId && currentUserId !== id && (
                    <AddToMyLinksButton link={link} currentUserId={currentUserId} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
}
