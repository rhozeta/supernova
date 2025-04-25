"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import NavMenu from '../components/NavMenu';

interface CreatorBreakdown {
  creator_id: string;
  username: string;
  qubits: number;
}

interface OriginalLink {
  user_id: string;
  user: {
    username: string;
  };
}

interface LinkRefWithCreator {
  click_count: number;
  original_link: OriginalLink;
}

export default function QubitsPage() {
  const [totalQubits, setTotalQubits] = useState(0);
  const [breakdown, setBreakdown] = useState<CreatorBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
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
    
    // Get all link_refs for user with original creator info
    const { data, error } = await supabase
      .from('link_refs')
      .select<LinkRefWithCreator>(`
        click_count,
        original_link:original_link_id (
          user_id,
          user:user_id (username)
        )
      `)
      .eq('user_id', userId);

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Calculate breakdown by creator
    const breakdownMap = new Map<string, CreatorBreakdown>();
    let total = 0;

    data.forEach((ref: LinkRefWithCreator) => {
      const creatorId = ref.original_link?.user_id;
      const username = ref.original_link?.user?.username || 'Unknown';
      const count = ref.click_count || 0;
      
      total += count;

      if (creatorId) {
        if (breakdownMap.has(creatorId)) {
          breakdownMap.get(creatorId)!.qubits += count;
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
