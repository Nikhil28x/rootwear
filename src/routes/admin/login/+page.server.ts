import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findStaffRole, previewAvailable } from '$lib/server/admin/session';
import { safeNext } from '$lib/server/admin/roles';
import { isSupabaseConfigured } from '$lib/server/env';
import {
	localAdminAvailable,
	localAdminLoginId,
	setLocalAdminSession,
	verifyLocalAdmin
} from '$lib/server/admin/local-session';
import { env } from '$env/dynamic/private';

/**
 * RW-151 — Staff sign-in.
 *
 * NO CREDENTIAL IS HARDCODED HERE, and none may ever be. Staff accounts are
 * created out of band by scripts/create-admin.mjs, which reads the email and
 * password from the environment and writes them through the Auth admin API
 * with the service-role key. This file only exchanges what the operator typed
 * for a session.
 *
 * THREE THINGS the form deliberately does NOT do:
 *
 *  - It does not say whether an email exists. "Those details did not match" is
 *    returned for a wrong password, an unknown address and a non-staff account
 *    alike, so the form cannot be used to enumerate accounts.
 *  - It does not keep a non-staff session alive. A customer who signs in here
 *    is signed straight back out, because leaving them authenticated inside the
 *    admin origin serves no purpose and widens the blast radius of any later
 *    mistake.
 *  - It does not echo the password back into the form value on failure.
 */
export const load: PageServerLoad = async ({ url }) => {
	return {
		next: url.searchParams.get('next'),
		configured: isSupabaseConfigured(),
		canPreview: previewAvailable(),
		canLocal: localAdminAvailable(),
		loginId: localAdminLoginId()
	};
};

const GENERIC_FAILURE = 'Those details did not match a Rootwear staff account.';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const loginId = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = String(form.get('next') ?? '') || null;

		if (!loginId || !password) {
			return fail(400, { email: loginId, error: 'Enter both a user ID and a password.' });
		}

		const supabase = event.locals.supabase;
		if (!supabase) {
			if (verifyLocalAdmin(loginId, password)) {
				await setLocalAdminSession(event.cookies);
				redirect(303, safeNext(next, 'owner'));
			}
			return fail(503, {
				email: loginId,
				error: localAdminAvailable()
					? GENERIC_FAILURE
					: 'Admin access is not configured on this deployment. Set the Supabase keys or the local admin environment values.'
			});
		}

		const authEmail =
			loginId.toLowerCase() === (env.ADMIN_LOGIN_ID ?? '').toLowerCase()
				? env.ADMIN_EMAIL || loginId
				: loginId;

		const { data, error: authError } = await supabase.auth.signInWithPassword({
			email: authEmail,
			password
		});

		if (authError || !data.user) {
			return fail(401, { email: loginId, error: GENERIC_FAILURE });
		}

		// Signed in is not staff. app.staff is the membership list.
		const role = await findStaffRole(data.user.id);
		if (!role) {
			await supabase.auth.signOut();
			return fail(403, { email: loginId, error: GENERIC_FAILURE });
		}

		redirect(303, safeNext(next, role));
	}
};
