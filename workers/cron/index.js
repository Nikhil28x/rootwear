/**
 * SvelteKit on Workers only answers HTTP, so this small worker turns
 * Cloudflare's cron triggers into authorised calls to /api/cron/*.
 */
const JOBS = {
	'*/2 * * * *': ['/api/cron/outbox'],
	'*/15 * * * *': ['/api/cron/carts'],
	'30 2 * * *': ['/api/cron/digest']
};

// Unpaid orders are swept on every tick, as often as the shortest schedule.
const EVERY_TICK = ['/api/cron/expire-orders'];

export default {
	async scheduled(controller, env, ctx) {
		const paths = [...new Set([...EVERY_TICK, ...(JOBS[controller.cron] ?? [])])];
		const runs = paths.map(async (path) => {
			const response = await fetch(new URL(path, env.SITE_URL), {
				method: 'POST',
				headers: { authorization: `Bearer ${env.CRON_SECRET}` }
			});
			if (!response.ok) {
				throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
			}
		});
		ctx.waitUntil(Promise.all(runs));
	}
};
