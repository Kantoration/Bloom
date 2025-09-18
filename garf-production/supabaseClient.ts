/**
 * Supabase Client Configuration
 * Handles connection to Supabase for data persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables (configure these in your .env file)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Create a Supabase client for public/anon access
 * Used for client-side operations and basic CRUD
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    }
  }
);

/**
 * Create a Supabase client with service role key
 * Used for server-side operations with elevated privileges
 */
export const supabaseAdmin: SupabaseClient = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })
  : supabase;

/**
 * Database type definitions matching Supabase schema
 */
export interface Database {
  public: {
    Tables: {
      runs: {
        Row: {
          id: string;
          created_at: string;
          options: Record<string, any>;
          summary: Record<string, any>;
          status?: 'pending' | 'running' | 'completed' | 'failed';
        };
        Insert: {
          id: string;
          created_at?: string;
          options?: Record<string, any>;
          summary?: Record<string, any>;
          status?: 'pending' | 'running' | 'completed' | 'failed';
        };
        Update: {
          id?: string;
          created_at?: string;
          options?: Record<string, any>;
          summary?: Record<string, any>;
          status?: 'pending' | 'running' | 'completed' | 'failed';
        };
      };
      groups: {
        Row: {
          id: string;
          run_id: string;
          score: number;
          size?: number;
          metadata?: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          score: number;
          size?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          score?: number;
          size?: number;
          metadata?: Record<string, any>;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          participant_id: string;
          role?: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          participant_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          participant_id?: string;
          role?: string;
        };
      };
      unassigned_queue: {
        Row: {
          id: string;
          run_id: string;
          participant_id: string;
          reason: string;
          details?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          participant_id: string;
          reason: string;
          details?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          participant_id?: string;
          reason?: string;
          details?: string;
        };
      };
      participants: {
        Row: {
          id: string;
          name?: string;
          email?: string;
          age?: number;
          kosher?: boolean;
          responses: Record<string, any>;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          name?: string;
          email?: string;
          age?: number;
          kosher?: boolean;
          responses: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          age?: number;
          kosher?: boolean;
          responses?: Record<string, any>;
          updated_at?: string;
        };
      };
    };
    Views: {
      run_statistics: {
        Row: {
          run_id: string;
          total_groups: number;
          total_participants: number;
          avg_group_size: number;
          avg_score: number;
        };
      };
      group_details: {
        Row: {
          group_id: string;
          run_id: string;
          score: number;
          member_count: number;
          members: string[];
        };
      };
    };
    Functions: {
      get_run_summary: {
        Args: { run_id: string };
        Returns: {
          run_id: string;
          created_at: string;
          total_groups: number;
          total_participants: number;
          unassigned_count: number;
        };
      };
    };
  };
}

/**
 * Helper function to check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Helper function to get the Supabase URL
 */
export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

/**
 * Helper function to handle Supabase errors
 */
export function handleSupabaseError(error: any): string {
  if (error?.message) {
    return error.message;
  }
  if (error?.details) {
    return error.details;
  }
  return 'An unknown error occurred';
}
