import { supabase, isSupabaseConfigured } from './supabaseClient.js';

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) to your environment.');
  }
}

export async function signUpWithEmail({ email, password, username }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user) {
    return sessionData.session.user;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
