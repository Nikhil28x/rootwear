/**
 * RW-136 — Who is asking, and which customer record is theirs.
 *
 * ONE rule, carried straight from src/hooks.server.ts and not negotiable here:
 * `locals.safeGetSession()` is the only trustworthy read. It calls getUser(),
 * which VALIDATES the JWT against the Auth server. `getSession()` reads an
 * unverified cookie — anyone can forge it — so it never authorises anything in
 * this file, and the customer id every repository call is scoped by comes from
 * here and nowhere else.
 *
 * §10 keeps guest checkout on and offers an account AFTER purchase, so being
 * signed in and having a customer record are two different facts. The customer
 * record is resolved (and linked, or created) through the repository, which is
 * what attaches a guest's order history to the account they make afterwards.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { isSupabaseConfigured } from '$lib/server/env';
import { account, usingFixtureRecords } from './index';
import type { AccountCustomer } from './types';

export type AccountAuth =
	| { readonly status: 'anonymous' }
	| {
			readonly status: 'signed_in';
			readonly userId: string;
			readonly email: string;
			readonly customer: AccountCustomer | null;
			/** A dev stand-in identity rather than a real signed-in user. */
			readonly preview: boolean;
			/** The records on screen are fixtures, not this person's real ones. */
			readonly fixtures: boolean;
	  };

/**
 * FIXTURE PREVIEW — so the account area is reviewable before Supabase exists.
 *
 * Three conditions, all required, and every one of them is false in a deployed
 * build: `dev` is only true under `vite dev`; a real deployment has Supabase
 * configured; and the address has to be named explicitly in the environment.
 * No credential is hardcoded anywhere in this file, and this switch grants
 * access to fixture records only — there is no real customer to impersonate
 * when there is no database.
 */
function previewEmail(): string | null {
	if (!dev || isSupabaseConfigured()) return null;
	const value = env.ACCOUNT_PREVIEW_EMAIL;
	return value && value.includes('@') ? value : null;
}

/** Tells the sign-in screen why there is no password to type. */
export function previewAvailable(): boolean {
	return dev && !isSupabaseConfigured();
}

/**
 * Resolved once per request. The layout load and the page load both want the
 * customer, and each resolution costs a round trip to the Auth server. Keyed
 * on the event object so nothing outlives the request — a module-level cache
 * would leak one visitor's identity into another's.
 */
const perRequest = new WeakMap<RequestEvent, Promise<AccountAuth>>();

export function resolveAccountAuth(event: RequestEvent): Promise<AccountAuth> {
	const cached = perRequest.get(event);
	if (cached) return cached;
	const pending = resolve(event);
	perRequest.set(event, pending);
	return pending;
}

async function resolve(event: RequestEvent): Promise<AccountAuth> {
	const preview = previewEmail();
	if (preview) {
		const customer = await account.findCustomerForUser('preview', preview);
		return {
			status: 'signed_in',
			userId: 'preview',
			email: preview,
			customer,
			preview: true,
			fixtures: true
		};
	}

	if (!isSupabaseConfigured()) return { status: 'anonymous' };

	// Validated JWT only. Never getSession().
	const { user } = await event.locals.safeGetSession();
	if (!user) return { status: 'anonymous' };

	const email = user.email ?? '';
	const customer = await account.findCustomerForUser(user.id, email);

	return {
		status: 'signed_in',
		userId: user.id,
		email,
		customer,
		preview: false,
		fixtures: usingFixtureRecords()
	};
}

/**
 * Where to send someone after sign-in.
 *
 * An open redirect turns the sign-in form into a phishing launcher, so only a
 * SAME-SITE ABSOLUTE PATH is honoured. `//evil.example` and `https://…` are
 * both rejected — the first is protocol-relative and reads as a path at a
 * glance, which is exactly why it is the one people miss.
 */
export function safeRedirect(value: string | null | undefined, fallback = '/account'): string {
	if (!value) return fallback;
	if (!value.startsWith('/')) return fallback;
	if (value.startsWith('//')) return fallback;
	if (value.startsWith('/\\')) return fallback;
	return value;
}
