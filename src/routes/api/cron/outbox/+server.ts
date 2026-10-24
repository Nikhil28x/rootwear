import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refuseCron } from '$lib/server/cron';
import { deliver } from '$lib/server/messaging/outbox';

/**
 * Sends whatever is due in the message outbox: retries after a provider
 * outage, and anything queued without sending immediately. Every minute or
 * two is plenty; overlapping runs are safe (rows are claimed SKIP LOCKED).
 */
async function run(request: Request): Promise<Response> {
	const refused = refuseCron(request);
	if (refused) return refused;

	const sent = await deliver();
	return json({
		processed: sent.length,
		sent: sent.filter((m) => m.status === 'sent').length,
		failed: sent.filter((m) => m.status === 'failed').length,
		retrying: sent.filter((m) => m.status === 'queued').length
	});
}

export const GET: RequestHandler = ({ request }) => run(request);
export const POST: RequestHandler = ({ request }) => run(request);
