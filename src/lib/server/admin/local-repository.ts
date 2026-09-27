/**
 * Admin access to form submissions captured while the local server is running.
 *
 * This deliberately contains no seed data. Without Supabase, visitor forms are
 * kept in memory by their form repositories and exposed here to the owner. The
 * records reset when the server process restarts.
 */
import { ZERO } from '$lib/money';
import { mockContactSnapshot, setMockContactStatus } from '$lib/server/content/contact';
import { mockDemandSnapshot } from '$lib/server/demand/mock-repository';
import type { AdminRepository } from './repository';
import type {
	AdminContactSubmission,
	AdminFormSubmission,
	DemandEntry,
	PreOrderLedger
} from './types';

function databaseRequired(): never {
	throw new Error('Connect Supabase before using this admin operation.');
}

function demandEntries(): DemandEntry[] {
	const submitted = mockDemandSnapshot();

	return [
		...submitted.requests.map((row) => ({
			id: row.id,
			trackingId: row.trackingId,
			kind: 'request' as const,
			dropId: row.dropId,
			dropSlug: row.dropId,
			dropName: row.dropId,
			variantId: row.variantId,
			size: null,
			email: row.email,
			name: null,
			phone: null,
			note: row.note,
			createdAt: row.consentedAt,
			position: null,
			state: 'open'
		})),
		...submitted.notifies.map((row) => ({
			id: row.id,
			trackingId: row.trackingId,
			kind: 'notify_me' as const,
			dropId: '',
			dropSlug: '',
			dropName: '',
			variantId: row.variantId,
			size: null,
			email: row.email,
			name: null,
			phone: null,
			note: null,
			createdAt: row.consentedAt,
			position: null,
			state: 'open'
		})),
		...submitted.preorders.map((row) => ({
			id: row.id,
			trackingId: row.trackingId,
			kind: 'preorder' as const,
			dropId: row.dropId,
			dropSlug: row.dropId,
			dropName: row.dropId,
			variantId: row.variantId,
			size: null,
			email: row.email,
			name: row.name,
			phone: row.phone,
			note: null,
			createdAt: row.consentedAt,
			position: null,
			state: 'open'
		}))
	].sort((a, b) => b.createdAt - a.createdAt);
}

function contactSubmissions(): AdminContactSubmission[] {
	return mockContactSnapshot()
		.map((row) => ({
			id: row.id,
			trackingId: row.trackingId,
			name: row.name,
			email: row.email,
			subject: row.subject,
			message: row.message,
			status: row.status,
			isSpam: row.isSpam ?? false,
			createdAt: row.createdAt
		}))
		.sort((a, b) => b.createdAt - a.createdAt);
}

function formSubmissions(): AdminFormSubmission[] {
	const demandRows: AdminFormSubmission[] = demandEntries().map((row) => ({
		trackingId: row.trackingId!,
		sourceId: row.id,
		kind:
			row.kind === 'request' ? 'drop_request' : row.kind === 'notify_me' ? 'notify_me' : 'preorder',
		name: row.name,
		email: row.email,
		phone: row.phone,
		dropId: row.dropId || null,
		variantId: row.variantId,
		subject:
			row.kind === 'request'
				? 'Request this drop'
				: row.kind === 'notify_me'
					? 'Notify me'
					: 'Pre-order signup',
		detail: row.note,
		status: row.state,
		isSpam: false,
		createdAt: row.createdAt
	}));

	return [
		...contactSubmissions().map((row) => ({
			trackingId: row.trackingId,
			sourceId: row.id,
			kind: 'contact' as const,
			name: row.name,
			email: row.email,
			phone: null,
			dropId: null,
			variantId: null,
			subject: row.subject,
			detail: row.message,
			status: row.status,
			isSpam: row.isSpam,
			createdAt: row.createdAt
		})),
		...demandRows
	].sort((a, b) => b.createdAt - a.createdAt);
}

const emptyLedger: PreOrderLedger = {
	depositsTaken: ZERO,
	depositCount: 0,
	balancesOutstanding: ZERO,
	balancesOutstandingCount: 0,
	balancesOverdue: ZERO,
	balancesOverdueCount: 0,
	refundsIssued: ZERO,
	refundCount: 0
};

export const localAdminRepository: AdminRepository = {
	listDropPerformance: async () => [],
	preOrderLedger: async () => emptyLedger,
	revenueByDrop: async () => [],
	listDemandRows: async () => [],
	listDemandEntries: async (filter) =>
		demandEntries()
			.filter((row) => (filter?.dropId ? row.dropId === filter.dropId : true))
			.filter((row) => (filter?.kind ? row.kind === filter.kind : true)),
	listFormSubmissions: async () => formSubmissions(),

	listDropRows: async () => [],
	findDropRow: async () => null,
	setDropState: async () => databaseRequired(),
	setDropPublished: async () => databaseRequired(),
	setDropLaunchInstant: async () => databaseRequired(),
	setVariantStock: async () => databaseRequired(),

	listOrders: async () => [],
	findOrder: async () => null,
	updateFulfilment: async () => databaseRequired(),
	packingList: async () => [],

	listReservations: async () => [],
	findReservation: async () => null,
	markBalanceRequested: async () => databaseRequired(),

	listContact: async (filter) =>
		contactSubmissions().filter((row) => (filter?.status ? row.status === filter.status : true)),
	setContactStatus: async ({ id, status }) => {
		if (!setMockContactStatus(id, status)) throw new Error(`Unknown submission ${id}`);
	}
};
