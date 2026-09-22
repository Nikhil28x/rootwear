import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findStaffRole, previewAvailable } from '$lib/server/admin/session';
import { safeNext } from '$lib/server/admin/roles';
import { isSupabaseConfigured } from '$lib/server/env';

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
		canPreview: previewAvailable()
	};
};

const GENERIC_FAILURE = 'Those details did not match a Rootwear staff account.';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = String(form.get('next') ?? '') || null;

		if (!email || !password) {
			return fail(400, { email, error: 'Enter both an email address and a password.' });
		}

		const supabase = event.locals.supabase;
		if (!supabase) {
			return fail(503, {
				email,
				error:
					'Supabase is not configured on this deployment, so there is nothing to sign in to. ' +
					'Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, then create a staff account ' +
					'with scripts/create-admin.mjs.'
			});
		}

		const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

		if (authError || !data.user) {
			return fail(401, { email, error: GENERIC_FAILURE });
		}

		// Signed in is not staff. app.staff is the membership list.
		const role = await findStaffRole(data.user.id);
		if (!role) {
			await supabase.auth.signOut();
			return fail(403, { email, error: GENERIC_FAILURE });
		}

		redirect(303, safeNext(next, role));
	}
};
