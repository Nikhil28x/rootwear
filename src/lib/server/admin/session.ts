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
import { error, type RequestEvent } from '@sveltejs/kit';
import { getServiceClient } from '$lib/server/db/clients';
import { isSupabaseConfigured } from '$lib/server/env';
import { isPermissionKey, type PermissionKey } from '$lib/admin/permissions';
import type { AdminActor } from './types';
import { readLocalAdminSession } from './local-session';

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
function previewRole(): 'owner' | 'layout' | null {
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
 * and each resolution costs a round trip to the Auth server plus a staff
 * lookup. Keyed on `locals`, which is the one object shared by every load in
 * a request (each load gets its own `event`, so keying on that never hit), and
 * nothing outlives the request (unlike a module-level cache, which would leak
 * one visitor's identity into another's request).
 */
const perRequest = new WeakMap<App.Locals, Promise<AdminAuth>>();

export function resolveAdminAuth(event: RequestEvent): Promise<AdminAuth> {
	const cached = perRequest.get(event.locals);
	if (cached) return cached;
	const pending = resolve(event);
	perRequest.set(event.locals, pending);
	return pending;
}

async function resolve(event: RequestEvent): Promise<AdminAuth> {
	const localId = await readLocalAdminSession(event.cookies);
	if (localId) {
		return {
			status: 'staff',
			actor: {
				userId: 'local-owner',
				email: localId,
				name: null,
				isOwner: true,
				permissions: [],
				preview: true
			}
		};
	}

	const preview = previewRole();
	if (preview) {
		return {
			status: 'staff',
			actor: {
				userId: 'preview',
				email: 'fixture preview',
				name: null,
				isOwner: preview === 'owner',
				permissions: preview === 'layout' ? ['layout.edit'] : [],
				preview: true
			}
		};
	}

	if (!isSupabaseConfigured()) return { status: 'anonymous' };

	// Validated JWT only. Never getSession().
	const { user } = await event.locals.safeGetSession();
	if (!user) return { status: 'anonymous' };

	const member = await findStaffMember(user.id);
	if (!member) return { status: 'not_staff', email: user.email ?? 'unknown' };

	return {
		status: 'staff',
		actor: {
			userId: user.id,
			email: user.email ?? 'unknown',
			name: member.name,
			isOwner: member.isOwner,
			permissions: member.permissions,
			preview: false
		}
	};
}

export type StaffMember = {
	readonly isOwner: boolean;
	readonly permissions: readonly PermissionKey[];
	readonly name: string | null;
};

/**
 * Reads app.staff. Returns null for a signed-in customer and for a
 * deactivated staff member, neither of which is an error.
 */
export async function findStaffMember(userId: string): Promise<StaffMember | null> {
	const { data, error: queryError } = await getServiceClient()
		.from('staff')
		.select('is_owner, permissions, display_name, active')
		.eq('user_id', userId)
		.maybeSingle();

	// Fail CLOSED. A lookup that errors is not a grant.
	if (queryError || !data) return null;

	const row = data as {
		is_owner: boolean;
		permissions: string[] | null;
		display_name: string | null;
		active: boolean;
	};
	if (!row.active) return null;

	return {
		isOwner: row.is_owner === true,
		// Unknown keys (a permission since removed from the code) grant nothing.
		permissions: (row.permissions ?? []).filter(isPermissionKey),
		name: row.display_name
	};
}

/** For the audit log: who did this, in a form that survives the user being deleted. */
export function actorLabel(actor: AdminActor): string {
	return actor.preview ? 'fixture-preview' : actor.email;
}

/**
 * The signed-in staff member, or a 403. For loads and actions under /admin,
 * where the layout guard has already redirected anonymous visitors — this is
 * the second, per-route check that does not trust the layout to have run.
 */
export async function staffActor(event: RequestEvent): Promise<AdminActor> {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	return auth.actor;
}
