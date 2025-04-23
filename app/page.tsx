import Image from "next/image";

import { redirect } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export const metadata = {
  title: "Supernova"
};

export default async function Home() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
