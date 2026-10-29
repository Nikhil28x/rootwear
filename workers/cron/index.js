/**
 * SvelteKit on Workers only answers HTTP, so this small worker turns
 * Cloudflare's cron triggers into authorised calls to /api/cron/*.
 *
 * One trigger, every 15 minutes. Unpaid orders are expired FIRST and on their
 * own, so they are failed in the database and their stock released before any
 * other job runs. The rest follow; cart reminders only on the hour. The
 * morning digest (/api/cron/digest) is switched off.
 */
const FIRST = '/api/cron/expire-orders';
const EVERY_TICK = ['/api/cron/outbox'];
const HOURLY = ['/api/cron/carts'];

async function run(env, path) {
	const response = await fetch(new URL(path, env.SITE_URL), {
		method: 'POST',
		headers: { authorization: `Bearer ${env.CRON_SECRET}` }
	});
	if (!response.ok) {
		throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
	}
}

async function tick(controller, env) {
	const errors = [];

	try {
		await run(env, FIRST);
	} catch (error) {
		errors.push(error);
	}

	const onTheHour = new Date(controller.scheduledTime).getUTCMinutes() === 0;
	const rest = onTheHour ? [...EVERY_TICK, ...HOURLY] : EVERY_TICK;
	const results = await Promise.allSettled(rest.map((path) => run(env, path)));
	for (const result of results) if (result.status === 'rejected') errors.push(result.reason);

	// Every job got its turn; now let failures show in the worker's logs.
	if (errors.length) throw new AggregateError(errors, errors.map(String).join('\n'));
}

export default {
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(tick(controller, env));
	}
};
