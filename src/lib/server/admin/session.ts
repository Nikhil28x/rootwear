/**
 * RW-142 — Who is asking, and are they staff.
 *
 * TWO rules carried from src/hooks.server.ts, and neither is negotiable here:
 *
 *   1. `locals.safeGetSession()` is the only trustworthy read. It calls
 *      getUser(), which VALIDATES the JWT against the Auth server.
 *      `getSession()` reads an unverified cookie — anyone can forge it — so it
 *      never authorises anything in this file.
 *
 *   2. Being signed in is NOT being staff. A customer with an account is a
 *      valid Supabase user; staff membership is a row in app.staff. The two
 *      checks are separate, and a signed-in customer gets a 403 rather than a
 *      redirect back to the login form they just completed (which would loop).
 *
 * app.staff lives in the `app` schema, which is deliberately NOT exposed
 * through PostgREST, so the role lookup runs on the service client. That is a
 * legitimate service-client use: the server is acting as the system to answer
 * "is this user staff", not acting as the visitor.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { getServiceClient } from '$lib/server/db/clients';
import { isSupabaseConfigured } from '$lib/server/env';
import type { AdminActor, StaffRole } from './types';

export type AdminAuth =
	| { readonly status: 'anonymous' }
	| { readonly status: 'not_staff'; readonly email: string }
	| { readonly status: 'staff'; readonly actor: AdminActor };

/**
 * FIXTURE PREVIEW — so the admin area is reviewable before Supabase exists.
 *
 * Three conditions, all required, and every one of them is false in a deployed
 * build: `dev` is only true under `vite dev`; a real deployment has Supabase
 * configured; and the role has to be named explicitly in the environment.
 * There is no hardcoded email and no hardcoded password anywhere in this file
 * — real credentials are created out of band by scripts/create-admin.mjs.
 */
function previewRole(): StaffRole | null {
	if (!dev || isSupabaseConfigured()) return null;
	const role = env.ADMIN_PREVIEW_ROLE;
	return role === 'owner' || role === 'layout' ? role : null;
}

/** Tells the login screen why there is no password field to fill in. */
export function previewAvailable(): boolean {
	return dev && !isSupabaseConfigured();
}

/**
 * Resolved once per request. Several loads on one page each want the actor,
 * and each resolution costs a round trip to the Auth server; keyed on the
 * event object so nothing outlives the request (unlike a module-level cache,
 * which would leak one visitor's identity into another's request).
 */
const perRequest = new WeakMap<RequestEvent, Promise<AdminAuth>>();

export function resolveAdminAuth(event: RequestEvent): Promise<AdminAuth> {
	const cached = perRequest.get(event);
	if (cached) return cached;
	const pending = resolve(event);
	perRequest.set(event, pending);
	return pending;
}

async function resolve(event: RequestEvent): Promise<AdminAuth> {
	const preview = previewRole();
	if (preview) {
		return {
			status: 'staff',
			actor: {
				userId: 'preview',
				email: 'fixture preview',
				role: preview,
				preview: true
			}
		};
	}

	if (!isSupabaseConfigured()) return { status: 'anonymous' };

	// Validated JWT only. Never getSession().
	const { user } = await event.locals.safeGetSession();
	if (!user) return { status: 'anonymous' };

	const role = await findStaffRole(user.id);
	if (!role) return { status: 'not_staff', email: user.email ?? 'unknown' };

	return {
		status: 'staff',
		actor: { userId: user.id, email: user.email ?? 'unknown', role, preview: false }
	};
}

/** Reads app.staff. Returns null for a signed-in customer, which is not an error. */
export async function findStaffRole(userId: string): Promise<StaffRole | null> {
	const { data, error: queryError } = await getServiceClient()
		.from('staff')
		.select('role')
		.eq('user_id', userId)
		.maybeSingle();

	// Fail CLOSED. A lookup that errors is not a grant.
	if (queryError || !data) return null;

	const role = (data as { role?: string }).role;
	return role === 'owner' || role === 'layout' ? role : null;
}

/** For the audit log: who did this, in a form that survives the user being deleted. */
export function actorLabel(actor: AdminActor): string {
	return actor.preview ? 'fixture-preview' : actor.email;
}
