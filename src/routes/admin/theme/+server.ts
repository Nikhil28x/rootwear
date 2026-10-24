import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeTheme, type ThemeChoice } from '$lib/server/admin/theme';

/** Stores the theme choice. Works as a plain form post and from fetch. */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const form = await request.formData();
	const value = String(form.get('theme') ?? 'system');
	const choice: ThemeChoice = value === 'light' || value === 'dark' ? value : 'system';
	writeTheme(cookies, choice);

	const back = String(form.get('back') ?? '');
	if (request.headers.get('accept')?.includes('application/json')) {
		return new Response(JSON.stringify({ theme: choice }), {
			headers: { 'content-type': 'application/json' }
		});
	}
	redirect(303, back.startsWith('/admin') && !back.startsWith('//') ? back : url.origin + '/admin');
};
