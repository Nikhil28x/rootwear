import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { contactInbox } from '$lib/server/content';

/**
 * §03 template 10 / §11 — the contact form.
 *
 * A real SvelteKit form action, so it works with JavaScript disabled: the
 * browser posts, the server validates, and the page re-renders with per-field
 * errors and the visitor's own words still in the boxes. `use:enhance` on the
 * component only removes the navigation.
 *
 * Nothing here decides where the message is stored — that is the repository
 * seam in $lib/server/content/contact.ts, which logs under
 * CATALOGUE_SOURCE=mock and writes app.contact_submissions under supabase.
 */

/** The subjects we can actually route. Free text produced an unsortable inbox. */
const SUBJECTS = [
	{ value: 'order', label: 'An order I have placed' },
	{ value: 'defect', label: 'Something arrived damaged' },
	{ value: 'sizing', label: 'Sizing and fit' },
	{ value: 'preorder', label: 'A pre-order, deposit or balance' },
	{ value: 'drop', label: 'A drop, a re-drop or a size that sold out' },
	{ value: 'press', label: 'Press, stockists or collaboration' },
	{ value: 'other', label: 'Something else' }
] as const;

const SUBJECT_VALUES = SUBJECTS.map((s) => s.value) as readonly string[];
const SUBJECT_LABEL = new Map(SUBJECTS.map((s) => [s.value as string, s.label as string]));

/**
 * Deliberately permissive. A pattern that insists on a TLD it has heard of
 * rejects real addresses; the address is confirmed by whether the reply
 * arrives, not by a regex.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LIMITS = { name: 120, email: 254, message: 4000 } as const;

type Values = { name: string; email: string; subject: string; message: string };
type FieldErrors = Partial<Record<keyof Values, string>>;

const field = (data: FormData, key: string) => (data.get(key) ?? '').toString().trim();

export const load: PageServerLoad = async () => {
	return { subjects: SUBJECTS.map(({ value, label }) => ({ value, label })) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();

		const values: Values = {
			name: field(data, 'name'),
			email: field(data, 'email'),
			subject: field(data, 'subject'),
			message: field(data, 'message')
		};

		// Honeypot. A human never sees this input, so anything in it is a bot.
		// The submission is recorded as spam and the sender is told it went
		// through: telling a bot it failed only teaches it to try again.
		const trap = field(data, 'website');

		const errors: FieldErrors = {};

		if (values.name.length === 0) {
			errors.name = 'Tell us what to call you.';
		} else if (values.name.length > LIMITS.name) {
			errors.name = `That is longer than ${LIMITS.name} characters.`;
		}

		if (values.email.length === 0) {
			errors.email = 'We need an address to reply to.';
		} else if (values.email.length > LIMITS.email || !EMAIL.test(values.email)) {
			errors.email = 'That does not look like an email address we could reply to.';
		}

		if (values.subject.length === 0) {
			errors.subject = 'Pick the closest subject so this reaches the right person.';
		} else if (!SUBJECT_VALUES.includes(values.subject)) {
			errors.subject = 'That is not one of the subjects on the list.';
		}

		if (values.message.length === 0) {
			errors.message = 'Tell us what has happened.';
		} else if (values.message.length < 10) {
			errors.message = 'A little more detail will get you a better answer.';
		} else if (values.message.length > LIMITS.message) {
			errors.message = `Keep it under ${LIMITS.message} characters — attach the rest by email.`;
		}

		if (Object.keys(errors).length > 0) {
			// The visitor's words come back with the errors. Retyping a long
			// message because one field was wrong is the worst thing a form does.
			return fail(400, { errors, values, sent: false });
		}

		const { user } = await locals.safeGetSession();

		try {
			await contactInbox.submit({
				name: values.name,
				email: values.email,
				// Stored as the readable label, so the inbox reads as English.
				subject: SUBJECT_LABEL.get(values.subject) ?? values.subject,
				message: values.message,
				userId: user?.id ?? null,
				isSpam: trap.length > 0
			});
		} catch (cause) {
			console.error('[contact] submit failed', cause);
			return fail(500, {
				// Typed, not inferred: an inline `{}` widens to the empty type and
				// the component can no longer read errors.name off the union.
				errors: {} as FieldErrors,
				values,
				sent: false,
				failure:
					'We could not record that just now. Please write to us directly — the address is below.'
			});
		}

		return { sent: true, name: values.name, email: values.email };
	}
};
