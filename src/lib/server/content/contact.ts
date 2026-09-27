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
import { nextMockTrackingId } from '$lib/server/submissions/tracking';

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

export type ContactWriteResult = {
	readonly status: ContactWriteStatus;
	readonly trackingId: string;
};

export interface ContactRepository {
	submit(input: ContactSubmission): Promise<ContactWriteResult>;
}

/**
 * Fixture implementation: held for this dev-server process and exposed to the
 * fixture admin inbox. Live deployments use Postgres.
 */
export type MockContactSubmission = ContactSubmission & {
	readonly id: string;
	readonly trackingId: string;
	status: 'new' | 'in_progress' | 'closed';
	readonly createdAt: number;
};

const mockContact = new Map<string, MockContactSubmission>();

export const mockContactRepository: ContactRepository = {
	async submit(input: ContactSubmission): Promise<ContactWriteResult> {
		const trackingId = nextMockTrackingId('CON');
		mockContact.set(trackingId, {
			...input,
			id: `contact-${mockContact.size + 1}`,
			trackingId,
			status: 'new',
			createdAt: Date.now()
		});
		if (input.isSpam) {
			console.info('[contact] honeypot tripped, quarantined:', input.email);
			return { status: 'quarantined', trackingId };
		}
		console.info(
			`[contact] ${input.name} <${input.email}> — ${input.subject}\n` +
				`          ${input.message.replace(/\s+/g, ' ').slice(0, 160)}`
		);
		return { status: 'received', trackingId };
	}
};

/** Owner-only fixture read used by the admin submissions inbox. */
export function mockContactSnapshot(): MockContactSubmission[] {
	return [...mockContact.values()];
}

export function setMockContactStatus(id: string, status: MockContactSubmission['status']): boolean {
	const row = [...mockContact.values()].find((submission) => submission.id === id);
	if (!row) return false;
	row.status = status;
	return true;
}

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
	async submit(input: ContactSubmission): Promise<ContactWriteResult> {
		const customerId = await resolveCustomerId(input.userId);

		const { data, error } = await getServiceClient()
			.from('contact_submissions')
			.insert({
				name: input.name,
				email: input.email,
				subject: input.subject,
				message: input.message,
				customer_id: customerId,
				is_spam: input.isSpam ?? false
			})
			.select('tracking_id')
			.single();

		if (error) throw new Error(`contact submit failed: ${error.message}`);
		return {
			status: input.isSpam ? 'quarantined' : 'received',
			trackingId: String(data.tracking_id)
		};
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
