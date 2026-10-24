import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refuseCron } from '$lib/server/cron';
import { autoRemind } from '$lib/server/carts/admin';

/**
 * Automatic cart reminders, when switched on in Carts → Settings. Every 15
 * minutes is plenty. Each checkout gets at most one reminder a day.
 */
async function run(request: Request): Promise<Response> {
	const refused = refuseCron(request);
	if (refused) return refused;
	return json({ reminded: await autoRemind(Date.now()) });
}

export const GET: RequestHandler = ({ request }) => run(request);
export const POST: RequestHandler = ({ request }) => run(request);
