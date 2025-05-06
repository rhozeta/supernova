"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { createProfile } from '../actions/createProfile';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contentCreator, setContentCreator] = useState(false);

  const validateUsername = (value: string) => {
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must be less than 20 characters';
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
      return 'Username must start with a letter and can only contain letters, numbers, underscores, and hyphens';
    }
    return '';  // no error
  };
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameValidationError = validateUsername(username);
    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      return;
    }
    setLoading(true);
    setError('');
    setUsernameError('');
    // First create the user
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
      // Create the profile using server action
      const result = await createProfile({
        id: user.id,
        username: username,
        content_creator: contentCreator,
      });
      
      if (!result.success) {
        setLoading(false);
        setError('Signup succeeded but failed to create profile: ' + (result.error || 'Unknown error'));
        return;
      }
    }
    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-transparent">
  <img src="/supernova-logo.svg" alt="Supernova Logo" className="h-16 w-16" />
</div>
<h1 className="text-2xl font-bold text-gray-800 dark:text-white">Create your Supernova account</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Join Link Shortener to start creating shortened links</p>
        </div>
        
        <form className="space-y-4" onSubmit={handleSignup}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
              required
            />
          </div>
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={e => {
                const value = e.target.value;
                setUsername(value);
                setUsernameError(validateUsername(value));
              }}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
              required
              pattern="^[a-zA-Z][a-zA-Z0-9_\-]*$"
              minLength={3}
              maxLength={20}
            />
            {usernameError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {usernameError}
              </p>
            )}
          </div>
          
          <div className="flex items-center mb-2">
            <input
              id="content-creator"
              type="checkbox"
              checked={contentCreator}
              onChange={e => setContentCreator(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="content-creator" className="text-sm text-gray-700 dark:text-gray-300">
              I am a content creator
            </label>
          </div>
          <button
            type="submit"
            className="w-full btn-accent py-3 rounded-lg font-semibold disabled:opacity-50 mt-2"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
        </form>
        
        <div className="mt-6 text-center">
          <Link 
            href="/login"
            className="text-orange-500 hover:text-orange-600 font-medium"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
