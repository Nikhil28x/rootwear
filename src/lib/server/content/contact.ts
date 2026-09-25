/**
 * §11 template 10 — the contact inbox seam.
 *
 * The same shape as every other repository in this codebase: an interface, a
 * fixture implementation, a Postgres implementation, and one place that picks
 * between them. Kept in a single file because it is three methods against one
 * table — splitting it four ways would add files, not clarity.
 *
 * Writes go to app.contact_submissions (migration 0010). The `app` schema is
 * not exposed through PostgREST, so this is service-role, server-side only —
 * a submission can never be written from the browser.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

/** Exactly the columns 0010 accepts from a visitor. */
export type ContactSubmission = {
	name: string;
	email: string;
	subject: string;
	message: string;
	/**
	 * The Supabase Auth user id when the sender was signed in. Resolved to an
	 * app.customers row by the Postgres implementation, so admin can read the
	 * message next to that person's orders. Route handlers never see a
	 * customer id and must not have to.
	 */
	userId?: string | null;
	/** A filled honeypot. Stored, never shown, never answered. */
	isSpam?: boolean;
};

export type ContactWriteStatus = 'received' | 'quarantined';

export interface ContactRepository {
	submit(input: ContactSubmission): Promise<ContactWriteStatus>;
}

/**
 * Fixture implementation: logs and succeeds.
 *
 * It does NOT pretend to persist. Nothing in the app reads a submission back,
 * so an in-memory list would be a lie told to no one — the log line is the
 * honest version, and it is what a developer running CATALOGUE_SOURCE=mock
 * actually wants to see.
 */
export const mockContactRepository: ContactRepository = {
	async submit(input: ContactSubmission): Promise<ContactWriteStatus> {
		if (input.isSpam) {
			console.info('[contact] honeypot tripped, quarantined:', input.email);
			return 'quarantined';
		}
		console.info(
			`[contact] ${input.name} <${input.email}> — ${input.subject}\n` +
				`          ${input.message.replace(/\s+/g, ' ').slice(0, 160)}`
		);
		return 'received';
	}
};

/**
 * auth.users.id -> app.customers.id. Returns null for a signed-out sender, or
 * for a signed-in one who has never ordered: a contact message is accepted
 * either way, so a missing customer row is not an error.
 */
async function resolveCustomerId(userId: string | null | undefined): Promise<string | null> {
	if (!userId) return null;

	const { data, error } = await getServiceClient()
		.from('customers')
		.select('id')
		.eq('user_id', userId)
		.maybeSingle();

	// Never fail a contact submission over the link to an order history.
	if (error) return null;
	return (data as { id: string } | null)?.id ?? null;
}

export const supabaseContactRepository: ContactRepository = {
	async submit(input: ContactSubmission): Promise<ContactWriteStatus> {
		const customerId = await resolveCustomerId(input.userId);

		const { error } = await getServiceClient()
			.from('contact_submissions')
			.insert({
				name: input.name,
				email: input.email,
				subject: input.subject,
				message: input.message,
				customer_id: customerId,
				is_spam: input.isSpam ?? false
			});

		if (error) throw new Error(`contact submit failed: ${error.message}`);
		return input.isSpam ? 'quarantined' : 'received';
	}
};

function selectRepository(): ContactRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseContactRepository;
	}
	return mockContactRepository;
}

/** Resolved per call so the switch works without a restart in dev. */
export const contactInbox: ContactRepository = {
	submit: (input) => selectRepository().submit(input)
};
