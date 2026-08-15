import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client — the *only* module that knows the project exists.
 *
 * KeyTopia is a static SPA (Vite build, served by Vercel), so there is no
 * server to hold a session: auth runs entirely in the browser with the PKCE
 * flow, and the publishable key ships in the bundle by design. What actually
 * protects the data is row-level security in Postgres (docs/schema.sql), which
 * scopes every row to `owner = auth.uid()`.
 *
 * Configuration is optional on purpose. With no env vars set, `supabase` is
 * null, the sign-in UI hides itself and the sync layer stays a no-op — the app
 * is exactly as local-first as it was before this file existed.
 */

const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

const URL = env.VITE_SUPABASE_URL?.trim() ?? '';
/** Supabase renamed `anon` to `publishable`; accept either name. */
const KEY = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(URL && KEY);
export const SUPABASE_URL = URL;
export const SUPABASE_KEY = KEY;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(URL, KEY, {
      auth: {
        // PKCE is the correct flow for a public browser client: no secret, and
        // the code exchange is bound to a verifier this tab generated.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth redirect lands on /auth/callback carrying `?code=`; the
        // client exchanges it for a session automatically.
        detectSessionInUrl: true,
        storageKey: 'keytopia-auth',
      },
    })
  : null;

/** Where providers send the browser back to. Must be in the Supabase redirect allowlist. */
export function authRedirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}
