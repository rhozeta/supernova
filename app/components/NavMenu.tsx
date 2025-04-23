"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NavMenu() {
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
      <Link href="/profile" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">Profile</Link>
    </nav>
  );
}
