import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log(`[Supabase] Client initialized for URL: ${SUPABASE_URL}`);
  } catch (err) {
    console.warn('[Supabase] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[Supabase] No valid SUPABASE_URL / SUPABASE_ANON_KEY found. Operating in local JSON mode.');
}

export function isSupabaseConfigured(): boolean {
  return Boolean(client && SUPABASE_URL && SUPABASE_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export async function testSupabaseConnection(): Promise<{ connected: boolean; url?: string; message: string }> {
  if (!client) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in environment (SUPABASE_URL, SUPABASE_ANON_KEY).',
    };
  }

  try {
    // Attempt a light query to test connectivity
    const { data, error } = await client.from('loopin_institutions').select('id').limit(1);
    if (error) {
      // Table might not exist yet, or permission issue
      if (error.code === '42P01') {
        return {
          connected: true,
          url: SUPABASE_URL,
          message: 'Connected to Supabase, but Loopin tables are not yet created. Run schema.sql in Supabase SQL editor or run npm run supabase:seed.',
        };
      }
      return {
        connected: false,
        url: SUPABASE_URL,
        message: `Supabase error: ${error.message} (${error.code || 'UNKNOWN'})`,
      };
    }
    return {
      connected: true,
      url: SUPABASE_URL,
      message: `Connected successfully to Supabase! Found ${data ? data.length : 0} institution records.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: SUPABASE_URL,
      message: `Network/connection error: ${err?.message || String(err)}`,
    };
  }
}
