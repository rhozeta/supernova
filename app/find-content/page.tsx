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

  return (
    <>
    <NavMenu></NavMenu>
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
    </div>
    </>
  );
}
