import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { previewAvailable, safeRedirect } from '$lib/server/account/session';
import { isSupabaseConfigured } from '$lib/server/env';

/**
 * RW-139 — Customer sign-in.
 *
 * WHAT THIS FORM DELIBERATELY REFUSES TO SAY.
 *
 * "Specific, but never revealing whether an email exists" is the whole design
 * here, and the two halves pull against each other. The resolution: be
 * specific about what the PERSON did, and generic about what the DATABASE
 * knows. An empty box, a malformed address and a rate limit are all facts
 * about this request and are named exactly. A wrong password, an unknown
 * address and an unconfirmed account all return the SAME sentence, because
 * telling them apart turns this form into an account-enumeration oracle —
 * someone can walk a list of addresses through it and learn who shops here.
 *
 * §10 also shapes it: guest checkout is on and an account is offered AFTER
 * purchase. Nobody is required to be here, so the page says so, and there is
 * no sign-up form to push people through before they are allowed to buy.
 */
export const load: PageServerLoad = async ({ url }) => {
	return {
		redirectTo: safeRedirect(url.searchParams.get('redirectTo')),
		// The Auth flow can land here after confirming an address.
		confirmed: url.searchParams.get('confirmed') === '1',
		notice: url.searchParams.get('notice') === 'signed-out',
		configured: isSupabaseConfigured(),
		canPreview: previewAvailable()
	};
};

/** One sentence for every outcome that would otherwise expose an account. */
const GENERIC_FAILURE =
	'Those details did not match an account. Check the address and the password, and try again.';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const redirectTo = safeRedirect(String(form.get('redirectTo') ?? ''));

		// Specific, because these are facts about the form, not about the account.
		if (!email && !password) {
			return fail(400, { email: '', error: 'Enter your email address and your password.' });
		}
		if (!email) {
			return fail(400, { email: '', error: 'Enter the email address you used at checkout.' });
		}
		if (!EMAIL_SHAPE.test(email)) {
			return fail(400, { email, error: 'That does not look like an email address.' });
		}
		if (!password) {
			return fail(400, { email, error: 'Enter your password.' });
		}

		const supabase = event.locals.supabase;
		if (!supabase) {
			return fail(503, {
				email,
				error:
					'Accounts are not available on this deployment yet, so there is nothing to sign in ' +
					'to. Guest checkout is unaffected — you can order without an account.'
			});
		}

		const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

		if (authError || !data.user) {
			// A rate limit is a fact about this request and says nothing about
			// whether the address exists, so it is safe — and kinder — to name it.
			if (authError?.status === 429) {
				return fail(429, {
					email,
					error: 'Too many attempts from here. Wait a minute, then try once more.'
				});
			}
			return fail(401, { email, error: GENERIC_FAILURE });
		}

		// Back to wherever they were headed. safeRedirect has already refused
		// anything that is not a same-site absolute path.
		redirect(303, redirectTo);
	}
};
