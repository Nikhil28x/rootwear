import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import {
	FORM_SUBMISSION_KINDS,
	type FormSubmissionKind
} from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';

function isKind(value: string | null): value is FormSubmissionKind {
	return value !== null && (FORM_SUBMISSION_KINDS as readonly string[]).includes(value);
}

export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'submissions');

	const all = await adminRepo.listFormSubmissions();
	const kindParam = event.url.searchParams.get('kind');
	const kind = isKind(kindParam) ? kindParam : undefined;
	const status = event.url.searchParams.get('status')?.trim() || undefined;
	const query = event.url.searchParams.get('q')?.trim() ?? '';
	const needle = query.toLocaleLowerCase('en-IN');

	const submissions = all.filter((row) => {
		if (kind && row.kind !== kind) return false;
		if (status && row.status !== status) return false;
		if (!needle) return true;
		return [
			row.trackingId,
			row.name,
			row.email,
			row.phone,
			row.subject,
			row.detail,
			row.dropId,
			row.variantId
		].some((value) => value?.toLocaleLowerCase('en-IN').includes(needle));
	});

	const startOfToday = new Date(event.locals.now);
	startOfToday.setHours(0, 0, 0, 0);

	return {
		now: event.locals.now,
		submissions,
		kinds: FORM_SUBMISSION_KINDS,
		statuses: [...new Set(all.map((row) => row.status))].sort(),
		filter: { kind: kind ?? '', status: status ?? '', query },
		counts: {
			total: all.length,
			open: all.filter((row) => row.status === 'open' || row.status === 'new').length,
			today: all.filter((row) => row.createdAt >= startOfToday.getTime()).length
		}
	};
};
