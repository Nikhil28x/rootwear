// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}

		interface Locals {
			/**
			 * RW-019 — the request-scoped server instant, stamped once in
			 * hooks.server.ts. Every drop-state and countdown resolution reads
			 * this rather than calling Date.now() again, so a single response
			 * cannot straddle the launch instant.
			 */
			now: number;

			/**
			 * RW-121 — the ANON client, carrying this visitor's session.
			 * RLS APPLIES. Null when Supabase is not configured.
			 * For system-level work use getServiceClient() instead, and only
			 * where the server is genuinely acting as the system.
			 */
			supabase: SupabaseClient | null;

			/**
			 * RW-120 — returns a session ONLY after validating the JWT with the
			 * Auth server. Use this, never getSession(), to authorise anything:
			 * getSession() reads an unverified cookie.
			 */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}

		interface PageData {
			session?: Session | null;
		}

		// interface PageState {}
		// interface Platform {}
	}
}

export {};
