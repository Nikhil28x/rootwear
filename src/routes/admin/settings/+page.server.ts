import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** /admin/settings opens the first tab this person can use. */
export const load: PageServerLoad = async ({ parent }) => {
	const { settingsTabs } = await parent();
	const first = settingsTabs[0];
	if (!first) error(403, 'Your account cannot change any settings. Ask an owner if you need to.');
	redirect(303, first.href);
};
