"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
    else router.push('/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Insert into profiles table
    const user = data?.user;
    if (user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        username: username,
        points: 0,
        created_at: new Date().toISOString(),
      });
      if (profileError) {
        setLoading(false);
        setError('Signup succeeded but failed to create profile: ' + profileError.message);
        return;
      }
    }
    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Login or Sign Up</h1>
      <form className="flex flex-col gap-2 w-80" onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50"
          disabled={loading}
        >
          Log In
        </button>
        <button
          type="button"
          className="bg-green-600 text-white py-2 rounded font-semibold disabled:opacity-50"
          disabled={loading}
          onClick={handleSignup}
        >
          Sign Up
        </button>
        {error && <div className="text-red-500">{error}</div>}
      </form>
    </div>
  );
}
