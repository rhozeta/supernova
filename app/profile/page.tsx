"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (user) fetchPoints();
    // eslint-disable-next-line
  }, [user]);

  const fetchPoints = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user.id)
      .single();
    if (!error && data) setPoints(data.points);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex flex-col items-center py-12 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-screen">
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white text-center">Profile</h1>
        <div className="mb-4 text-gray-700 dark:text-gray-300">Email: <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span></div>
        <div className="mb-6 text-gray-700 dark:text-gray-300">Qubits: <span className="font-semibold text-orange-500">{points}</span></div>
        <button
          onClick={handleLogout}
          className="w-full btn-accent py-2 px-4 rounded-lg font-semibold"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
