import { createClient } from '@supabase/supabase-js';

// Only the publishable key belongs in the browser. Never put a service_role or
// secret key here: every request runs with the signed-in user's permissions.
const url = (import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  || 'https://wabyrfyvfuxtgmxaozin.supabase.co';
const key = (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  || 'sb_publishable_WTj6oTOdWnCvo8aEYAKkqg_tNr9Jf5R';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
