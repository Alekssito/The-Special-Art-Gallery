import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const rememberMePreferenceKey = 'sag-remember-me';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function setRememberMePreference(rememberMe) {
  if (!isBrowser()) return;
  window.localStorage.setItem(rememberMePreferenceKey, rememberMe ? '1' : '0');
}

export function getRememberMePreference() {
  if (!isBrowser()) return true;
  const stored = window.localStorage.getItem(rememberMePreferenceKey);
  if (stored === null) return true;
  return stored === '1';
}

const authStorage = {
  getItem(key) {
    if (!isBrowser()) return null;
    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) return localValue;
    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (!isBrowser()) return;
    const rememberMe = getRememberMePreference();
    if (rememberMe) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  },
  removeItem(key) {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
