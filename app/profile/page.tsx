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
    <div className="flex flex-col items-center py-12">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="mb-2">Email: <span className="font-semibold">{user?.email}</span></div>
      <div className="mb-2">Points: <span className="font-semibold">{points}</span></div>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded font-semibold"
      >
        Log Out
      </button>
    </div>
  );
}
