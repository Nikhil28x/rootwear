/**
 * RW-121 — The anon / service-role boundary, written down.
 *
 * TWO clients, and the difference matters more than anything else in this
 * directory:
 *
 *   anon client     — carries the visitor's session. RLS APPLIES. Use this for
 *                     anything acting AS the visitor. It can read published
 *                     catalogue rows and the visitor's own orders, nothing else.
 *
 *   service client  — carries the service-role key. RLS IS BYPASSED ENTIRELY.
 *                     Use it ONLY where the server is acting as the system:
 *                     order commit, webhook processing, piece allocation,
 *                     refunds, scheduled jobs, admin reads.
 *
 * THE RULE: never reach for the service client to make something work. If an
 * anon-client query returns nothing, that is RLS doing its job — fix the
 * policy or the query, do not escalate. Every service-client call site should
 * be justifiable as "the system is acting, not the visitor".
 *
 * Tables that must NEVER be written from the browser (§04): orders,
 * order_lines, payments, refunds, reservations, waitlist_entries, variants
 * (stock), webhook_events. They live in the `app` schema, which is not exposed
 * through PostgREST, so this is enforced structurally as well as by policy.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '$lib/server/env';

/**
 * Request-scoped client carrying the visitor's cookies. RLS applies.
 * Created per request in hooks.server.ts — never cached across requests.
 */
export function createAnonClient(event: RequestEvent): SupabaseClient {
	return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const { name, value, options } of cookies) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});
}

/** The `app` schema carries a different generic than the default `public`. */
type AppClient = SupabaseClient<any, 'app', any>;

let serviceClient: AppClient | null = null;

/**
 * System-level client. RLS BYPASSED. Never pass this anywhere a request
 * handler could hand it user-controlled filters.
 *
 * Safe to cache at module scope: it holds no per-user state, unlike the anon
 * client, which must never be module-scoped (it would leak one visitor's
 * session into another's request).
 */
export function getServiceClient(): AppClient {
	if (!serviceClient) {
		serviceClient = createClient<any, 'app', any>(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
			auth: { persistSession: false, autoRefreshToken: false },
			db: { schema: 'app' }
		});
	}
	return serviceClient;
}

/** Service client scoped to the public (catalogue) schema. */
export function getCatalogueClient(): SupabaseClient {
	return createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}
