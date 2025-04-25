"use client";
import Link from "next/link";


import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function LoginOrDashButton() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="absolute top-6 right-8 z-20">
      {user ? (
        <a href="/dashboard">
          <button className="btn-accent px-6 py-2 text-base">Go to Dash</button>
        </a>
      ) : (
        <a href="/login">
          <button className="btn-accent px-6 py-2 text-base">Login</button>
        </a>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* Main navigation menu */}
      <nav className="w-full flex justify-center items-center gap-8 py-6 mb-8 border-b border-gray-100 dark:border-gray-800 bg-transparent">
        <Link href="/" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">Home</Link>
        <Link href="/for-creators" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">For Creators</Link>
        <Link href="/for-fans" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">For Fans</Link>
        <Link href="/how-it-works" className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">How it Works</Link>
        <div className="ml-auto">
          <LoginOrDashButton />
        </div>
      </nav>
      <main className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      {/* Hero Section */}
      <section className="w-full max-w-3xl text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-300">Get Rewarded for Sharing What You Love</h1>
        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8">
          Supernova lets you earn rewards every time you share content from your favorite creators. Support the people you love and get rewarded for spreading the word!
        </p>
        <Link href="/signup">
          <button className="btn-accent text-lg px-8 py-3">Start Earning – Sign Up</button>
        </Link>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card-glass flex flex-col items-center">
          <svg className="w-10 h-10 mb-3 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.485-8.485l-.707.707m-13.556 0l-.707-.707m16.97 0a9 9 0 11-12.728 0 9 9 0 0112.728 0z" /></svg>
          <h3 className="font-semibold text-lg mb-2">Earn Rewards for Sharing</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center">Share links to your favorite creators' content and earn rewards when people click your links.</p>
        </div>
        <div className="card-glass flex flex-col items-center">
          <svg className="w-10 h-10 mb-3 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 7.165 6 9.388 6 12v2.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <h3 className="font-semibold text-lg mb-2">Support Your Favorite Creators</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center">Help creators grow by sharing their content and introducing them to new audiences.</p>
        </div>
        <div className="card-glass flex flex-col items-center">
          <svg className="w-10 h-10 mb-3 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4m0 0l-5-5m5 5l-5 5" /></svg>
          <h3 className="font-semibold text-lg mb-2">Track Your Impact</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center">See how many clicks your links get and how much you’ve earned, all in a beautiful, modern dashboard.</p>
        </div>
      </section>
    </main>
    </>
  );
}
