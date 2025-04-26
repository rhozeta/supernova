"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import NavMenu from '../components/NavMenu';
import { User } from '@supabase/supabase-js';

interface CreatorBreakdown {
  creator_id: string;
  username: string;
  qubits: number;
}

interface OriginalLink {
  user_id: string;
  user: {
    username: string;
    id: string;
  };
}

interface LinkRefWithCreator {
  click_count: number;
  original_link: OriginalLink | null;
}

export default function QubitsPage() {
  const [totalQubits, setTotalQubits] = useState(0);
  const [breakdown, setBreakdown] = useState<CreatorBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [contentCreator, setContentCreator] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      
      // Check if user is content creator
      const { data } = await supabase
        .from('profiles')
        .select('content_creator')
        .eq('id', user.id)
        .single();
      
      if (data?.content_creator) {
        router.push('/dashboard');
      } else {
        setContentCreator(false);
        fetchQubitsBreakdown(user.id);
      }
    };

    fetchUser();
  }, []);

  const fetchQubitsBreakdown = async (userId: string) => {
    setLoading(true);
    
    // First get all link_refs for the user
    const { data: refsData, error: refsError } = await supabase
      .from('link_refs')
      .select('click_count, original_link_id')
      .eq('user_id', userId);

    if (refsError || !refsData) {
      setLoading(false);
      return;
    }

    // Then get the creator info for each original link
    const linkIds = refsData.map(ref => ref.original_link_id);
    const { data: linksData, error: linksError } = await supabase
      .from('links')
      .select('id, user_id, user:user_id (username, id)')
      .in('id', linkIds);

    if (linksError || !linksData) {
      setLoading(false);
      return;
    }

    // Combine the data
    const combinedData = refsData.map(ref => {
      const link = linksData.find(l => l.id === ref.original_link_id);
      return {
        click_count: ref.click_count || 0,
        original_link: link ? {
          user_id: link.user_id,
          user: link.user[0] as { username: string; id: string }
        } : null
      };
    });

    // Calculate breakdown
    const breakdownMap = new Map<string, CreatorBreakdown>();
    let total = 0;

    combinedData.forEach(ref => {
      const creatorId = ref.original_link?.user_id;
      const username = ref.original_link?.user?.username || 'Unknown';
      const count = ref.click_count;
      
      total += count;

      if (creatorId) {
        const existing = breakdownMap.get(creatorId);
        if (existing) {
          existing.qubits += count;
        } else {
          breakdownMap.set(creatorId, {
            creator_id: creatorId,
            username,
            qubits: count
          });
        }
      }
    });

    setTotalQubits(total);
    setBreakdown(Array.from(breakdownMap.values()));
    setLoading(false);
  };

  if (!user || contentCreator) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavMenu />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Qubits Breakdown</h1>
        
        {/* Total Qubits Card */}
        <div className="bg-blue-100 dark:bg-blue-900 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-2">Total Qubits</h2>
          <p className="text-4xl font-bold">{totalQubits.toLocaleString()}</p>
        </div>

        {/* Breakdown Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Content Creator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Qubits
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : (
                breakdown.map((item) => (
                  <tr key={item.creator_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.qubits.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
