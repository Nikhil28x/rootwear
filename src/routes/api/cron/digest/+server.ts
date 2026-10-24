import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refuseCron } from '$lib/server/cron';
import { sendDigest } from '$lib/server/alerts';

/** The daily digest. Schedule once a day, e.g. 08:00 IST (02:30 UTC). */
async function run(request: Request): Promise<Response> {
	const refused = refuseCron(request);
	if (refused) return refused;
	return json({ sentTo: await sendDigest(Date.now()) });
}

export const GET: RequestHandler = ({ request }) => run(request);
export const POST: RequestHandler = ({ request }) => run(request);
