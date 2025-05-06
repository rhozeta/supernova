"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

interface Link {
  id: string;
  original_url: string;
  short_code: string;
  page_title?: string;
  page_image?: string;
  page_favicon?: string;
  page_description?: string;
  click_count: number;
}

function AddToMyLinksButton({ link, currentUserId }: { link: Link, currentUserId: string }) {
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
  const username = params?.id as string;
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [unfollowError, setUnfollowError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [qubitsEarned, setQubitsEarned] = useState(0);
  interface Reward {
    id: string;
    title: string;
    description: string;
    qubit_cost: number;
    creator_id: string;
    active: boolean;
    created_at: string;
  }

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [userQubits, setUserQubits] = useState<number>(0);
  const [claimingReward, setClaimingReward] = useState(false);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('State updated:', {
      userQubits,
      qubitsEarned,
      currentUserId,
      rewards,
      loadingRewards,
      claimingReward
    });
  }, [userQubits, qubitsEarned, currentUserId, rewards, loadingRewards, claimingReward]);

  interface LinkRef {
    click_count: number;
    original_link: {
      user_id: string;
    };
  }

  const fetchUserQubits = async (userId: string) => {
    console.log('Fetching qubits for user:', userId, 'viewing creator:', username);

    try {
      // Get creator profile first
      const { data: creatorData, error: creatorError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (creatorError || !creatorData) {
        console.error('Error fetching creator profile:', creatorError);
        setQubitsEarned(0);
        return;
      }

      // Use the creator ID directly from the query result
      const creatorId = creatorData.id;
      setCreatorId(creatorId);

      // Get all link_refs for links created by this creator AND fetch user's total qubits
      const [refsResult, userResult] = await Promise.all([
        supabase
          .from('link_refs')
          .select(`
            click_count,
            original_link_id,
            links!inner (user_id)
          `)
          .eq('user_id', userId)
          .eq('links.user_id', creatorId),
        supabase
          .from('profiles')
          .select('qubits')
          .eq('id', userId)
          .single()
      ]);

      const { data: refsData, error: refsError } = refsResult;
      const { data: userData, error: userError } = userResult;

      if (refsError) {
        console.error('Error fetching link_refs:', refsError);
        setQubitsEarned(0);
        return;
      }

      if (userError) {
        console.error('Error fetching user qubits:', userError);
        setUserQubits(0);
        return;
      }

      if (!refsData || refsData.length === 0) {
        console.log('No link_refs found');
        setQubitsEarned(0);
        return;
      }

      console.log('Found link_refs:', refsData);

      // Sum up click_count values, ensuring we only count each link once
      const linkClicks = new Map(); // Map to store highest click count per original link
      
      refsData.forEach(ref => {
        const currentClicks = ref.click_count || 0;
        const existingClicks = linkClicks.get(ref.original_link_id) || 0;
        
        // Only update if this ref has more clicks
        if (currentClicks > existingClicks) {
          linkClicks.set(ref.original_link_id, currentClicks);
        }
      });
      
      // Calculate total clicks from this creator's links
      const totalClicks = Array.from(linkClicks.values()).reduce((sum, clicks) => sum + clicks, 0);
      
      console.log('Setting qubits earned from creator:', {
        totalClicks,
        linkClicks: Object.fromEntries(linkClicks),
        rawUserData: userData,
        currentState: { userQubits, qubitsEarned }
      });
      setQubitsEarned(totalClicks);
    } catch (err) {
      console.error('Error calculating qubits:', err);
      setQubitsEarned(0);
      setUserQubits(0);
    }
  };

  const fetchRewards = async () => {
    console.log('Fetching rewards for creator:', creatorId);
    if (!creatorId) {
      console.log('No creator ID available, skipping rewards fetch');
      return;
    }
    
    setLoadingRewards(true);
    setRewardsError(null);
    
    try {
      // Fetch rewards created by this creator
      console.log('Fetching rewards for creator:', creatorId);
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('rewards')
        .select('id, title, description, qubit_cost, creator_id, active, created_at')
        .eq('creator_id', creatorId)
        .eq('active', true)
        .order('qubit_cost', { ascending: true });

      if (rewardsError) throw rewardsError;
      
      setRewards(rewardsData || []);

      // Log rewards for debugging
      console.log('Fetched rewards:', rewardsData);
      
      // Log rewards data for debugging
      console.log('Rewards data:', {
        rewards: rewardsData,
        currentUserId,
        qubitsEarned,
        userQubits
      });
    } catch (err: any) {
      console.error('Error fetching rewards:', err);
      setRewardsError(err.message);
    } finally {
      setLoadingRewards(false);
    }
  };

  // Effect for fetching rewards whenever creatorId changes
  useEffect(() => {
    if (creatorId) {
      fetchRewards();
    }
  }, [creatorId]);

  // Effect for initial data loading
  useEffect(() => {
    // Get current user id for follow logic
    const getCurrentUser = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getUser();
        const userId = sessionData?.user?.id || null;
        setCurrentUserId(userId);
        
        // Fetch qubits if we have a user
        if (userId) {
          // Get user's total qubits first
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('qubits')
            .eq('id', userId)
            .single();

          if (userError) {
            console.error('Error fetching user qubits:', userError);
            setUserQubits(0);
          } else {
            const totalQubits = userData?.qubits || 0;
            console.log('Initial user qubits:', {
              userId,
              totalQubits,
              rawUserData: userData
            });
            setUserQubits(totalQubits);
          }

          // Then fetch qubits earned from this creator
          fetchUserQubits(userId);
        }
      } catch (err) {
        console.error('Error in getCurrentUser:', err);
        setUserQubits(0);
      }
    };
    getCurrentUser();

    const fetchProfileAndLinks = async () => {
      setLoading(true);
      setError("");
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("username", username)
        .single();
      if (profileError || !profileData) {
        setError("Creator not found");
        setLoading(false);
        return;
      }
      // Set creator ID first since other fetches depend on it
      setCreatorId(profileData.id);
      
      // Then set profile
      setProfile(profileData);

      // Fetch links
      const { data: linksData, error: linksError } = await supabase
        .from("links")
        .select("id, original_url, created_at, page_title, page_image, page_favicon, page_description, click_count, short_code")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });
      if (linksError) {
        setError("Error loading links");
        setLoading(false);
        return;
      }
      setLinks(linksData || []);
      setLoading(false);
    };
    if (username) {
      fetchProfileAndLinks();
    }
  }, [username, currentUserId]);

  // Check follow status whenever currentUserId or creatorId changes
  useEffect(() => {
    const checkFollowing = async () => {
      if (!currentUserId || !creatorId || currentUserId === creatorId) return;
      
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('creator_id', creatorId)
          .maybeSingle();

        if (error) throw error;
        setIsFollowing(!!data);
      } catch (err) {
        console.error('Error checking follow status:', err);
      }
    };

    checkFollowing();
  }, [currentUserId, creatorId]);

  // Unfollow handler
  const handleUnfollow = async () => {
    setLoadingFollow(true);
    setUnfollowError("");
    console.log(`Attempting to unfollow: follower=${currentUserId}, followed=${creatorId}`);
    if (!currentUserId || !creatorId) {
      setUnfollowError("User or creator ID missing.");
      setLoadingFollow(false);
      return;
    }
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('creator_id', creatorId);
    setLoadingFollow(false);
    if (error) {
      setUnfollowError("Error unfollowing creator");
      console.error('Error unfollowing creator:', error);
    } else {
      setIsFollowing(false);
    }
  };

  // Follow handler
  const handleFollow = async () => {
    setLoadingFollow(true);
    console.log(`Attempting to follow: follower=${currentUserId}, followed=${creatorId}`);
    if (!currentUserId || !creatorId) {
      console.error("User or creator ID missing for follow.");
      setLoadingFollow(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getUser();
    const followerId = sessionData?.user?.id;
    if (!followerId || !username) return;
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, creator_id: creatorId });
    setLoadingFollow(false);
    if (error) {
      console.error('Error following creator:', error);
      // Potentially set an error state here to show the user
    } else {
      setIsFollowing(true);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto py-12 px-4 text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="max-w-2xl mx-auto py-12 px-4 text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
        </div>
        <h1 className="text-3xl font-bold">{profile.username}</h1>
      </div>
      {isFollowing && currentUserId && currentUserId !== creatorId && (
        <div className="relative group">
          <button 
            onClick={handleUnfollow}
            className="px-3 py-1.5 text-sm rounded-md flex items-center bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-red-900/30 dark:hover:text-red-300 transition-colors"
          >
            <span className="group-hover:hidden">Following</span>
            <span className="hidden group-hover:inline">Unfollow</span>
          </button>
        </div>
      )}
      {currentUserId && currentUserId !== creatorId && (
        <div className="bg-orange-100 dark:bg-orange-900/30 p-6 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-2 text-orange-800 dark:text-orange-200">Your Qubits</h2>
          <p className="text-4xl font-bold text-orange-600 dark:text-orange-300">{qubitsEarned.toLocaleString()}</p>
          <p className="text-sm text-orange-700 dark:text-orange-400 mt-2">earned from this creator's content</p>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Available Rewards</h2>
            {currentUserId && currentUserId !== creatorId && (
              <div className="text-lg font-medium text-orange-600 dark:text-orange-400">
                Available Qubits: {qubitsEarned.toLocaleString()}
              </div>
            )}
          </div>
          {currentUserId && currentUserId !== creatorId && (
            <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Qubits Earned from {profile?.username}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Only qubits earned from {profile?.username}'s content can be used for their rewards</p>
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  <div>{qubitsEarned.toLocaleString()}</div>
                  <div className="text-sm mt-1">available to spend</div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {loadingRewards ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        ) : rewardsError ? (
          <div className="text-red-500 text-center">{rewardsError}</div>
        ) : rewards.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-4">
            No rewards available at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div key={reward.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{reward.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{reward.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{reward.qubit_cost} Qubits</span>
                  <button
                    onClick={() => {
                      if (!currentUserId) {
                        alert('Please log in to claim rewards');
                        return;
                      }
                      if (qubitsEarned < reward.qubit_cost) {
                        alert('Not enough Qubits to claim this reward');
                        return;
                      }
                      console.log('Claiming reward:', {
                        qubitsEarned,
                        rewardCost: reward.qubit_cost,
                        hasEnough: qubitsEarned >= reward.qubit_cost
                      });
                      if (claimingReward) return;
                      
                      const handleClaim = async () => {
                        setClaimingReward(true);
                        try {
                          // Debug info
                          console.log('Attempting to claim reward:', {
                            reward,
                            currentUserId,
                            creatorId,
                            qubitsEarned,
                            userQubits
                          });

                          // Get current earned qubits
                          const { data: earnedData, error: earnedError } = await supabase
                            .rpc('get_earned_qubits', {
                              user_id: currentUserId,
                              creator_id: creatorId
                            });

                          console.log('Earned qubits check:', {
                            earnedData,
                            earnedError
                          });

                          if (earnedError) {
                            throw new Error(`Error checking earned qubits: ${earnedError.message}`);
                          }

                          // Start a Supabase transaction
                          const { error: claimError } = await supabase
                            .from('reward_claims')
                            .insert({
                              reward_id: reward.id,
                              user_id: currentUserId,
                              creator_id: creatorId,
                              status: 'pending'
                            });

                          if (claimError) throw claimError;

                          // Update user's qubits balance
                          const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ qubits: qubitsEarned - reward.qubit_cost })
                            .eq('id', currentUserId);

                          if (updateError) throw updateError;

                          // Update local state
                          setQubitsEarned(prev => prev - reward.qubit_cost);
                          alert('Reward claimed successfully!');
                        } catch (err) {
                          console.error('Error claiming reward:', err);
                          alert('Failed to claim reward. Please try again.');
                        } finally {
                          setClaimingReward(false);
                        }
                      };

                      handleClaim();
                    }}
                    disabled={!currentUserId || qubitsEarned < reward.qubit_cost || claimingReward}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${(() => {
                      console.log('Button render state:', {
                        currentUserId,
                        qubitsEarned,
                        rewardCost: reward.qubit_cost,
                        claimingReward,
                        hasEnoughQubits: qubitsEarned >= reward.qubit_cost
                      });
                      return !currentUserId || qubitsEarned < reward.qubit_cost || claimingReward
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700';
                    })()}`}
                  >
                    {(() => {
                      const buttonState = !currentUserId ? 'Login to Claim' : 
                        claimingReward ? 'Claiming...' :
                        qubitsEarned < reward.qubit_cost ? 'Not Enough Qubits' : 
                        'Claim Reward';
                      console.log('Button text:', {
                        buttonState,
                        qubitsEarned,
                        rewardCost: reward.qubit_cost,
                        comparison: `${qubitsEarned} < ${reward.qubit_cost} = ${qubitsEarned < reward.qubit_cost}`
                      });
                      return buttonState;
                    })()}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!isFollowing && currentUserId && currentUserId !== creatorId && (
        <button
          onClick={handleFollow}
          className="px-3 py-1.5 text-sm rounded-md flex items-center bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/30"
        >
          Follow
        </button>
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
                  {currentUserId && <AddToMyLinksButton link={link} currentUserId={currentUserId} />}
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {link.click_count}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
