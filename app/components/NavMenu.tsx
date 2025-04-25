"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface NavMenuProps { onProfileClick?: () => void }

export default function NavMenu({ onProfileClick }: NavMenuProps) {
  const [contentCreator, setContentCreator] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function fetchContentCreator() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("content_creator")
        .eq("id", user.id)
        .single();
      if (!error && data) setContentCreator(!!data.content_creator);
      setChecked(true);
    }
    fetchContentCreator();
  }, []);

  // Hide menu until user status is checked (avoid flicker)
  if (!checked) return null;

  return (
    <nav className="w-full flex justify-center items-center gap-8 mb-6">
      <Link href="/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">Dashboard</Link>
      <Link href="/find-content" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">Find Content</Link>
      {onProfileClick ? (
        <button onClick={onProfileClick} className="btn-accent flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 inline-block">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Profile
        </button>
      ) : (
        <Link href="/profile" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">Profile</Link>
      )}
    </nav>
  );
}
