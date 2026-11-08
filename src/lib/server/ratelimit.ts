/**
 * Per-visitor limits on form posts, so a script can't hold a whole edition
 * with throwaway orders, guess passwords, or flood the forms.
 *
 * Counted by Cloudflare's rate limiting bindings (wrangler.jsonc,
 * `ratelimits`), keyed by the visitor's IP and the path posted to. The counts
 * are per Cloudflare location and approximate, which is what this needs: a
 * ceiling far above any person, well below any script. Without the bindings
 * (vite dev, tests) nothing is limited.
 */
import type { RequestEvent } from '@sveltejs/kit';

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

/** Sign-in, placing an order, paying, writing to us: 10 a minute. */
const STRICT = [
	'/admin/login',
	'/admin/account',
	'/account/login',
	'/checkout/information',
	'/checkout/processing',
	'/checkout/balance',
	'/contact',
	// Order lookup: guessing an order's contact details (see orders/lookup.ts).
	'/track'
];

/** Webhooks and crons are called by Razorpay, Meta and the cron Worker. */
const EXEMPT = ['/api/webhooks/', '/api/cron/'];

function limiterFor(event: RequestEvent): Limiter | null {
	const env = event.platform?.env;
	if (!env) return null;
	const path = event.url.pathname;
	if (EXEMPT.some((prefix) => path.startsWith(prefix))) return null;
	if (STRICT.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) {
		return env.LIMIT_STRICT ?? null;
	}
	// Staff work in bursts (stock edits, packing) and are signed in; the
	// sign-in form itself is limited above.
	if (path.startsWith('/admin')) return null;
	return env.LIMIT_FORMS ?? null;
}

/** True when this post is over its limit and should be refused. */
export async function overLimit(event: RequestEvent): Promise<boolean> {
	if (event.request.method !== 'POST') return false;
	const limiter = limiterFor(event);
	if (!limiter) return false;
	const ip = event.request.headers.get('cf-connecting-ip') ?? 'unknown';
	const { success } = await limiter.limit({ key: `${ip}:${event.url.pathname}` });
	return !success;
}

const MESSAGE = 'Too many tries in a row. Wait a minute, then try again.';

/**
 * The refusal, shaped for whoever asked: a form enhanced by SvelteKit reads an
 * action result (so the page shows the message where its errors go), anything
 * else gets plain text.
 */
export function tooManyRequests(event: RequestEvent): Response {
	const headers = { 'retry-after': '60' };
	if (event.request.headers.get('x-sveltekit-action') === 'true') {
		// The `data` field is devalue-encoded, which for a flat object of
		// strings is an index table followed by the values.
		const data = JSON.stringify([{ problem: 1, error: 1 }, MESSAGE]);
		return new Response(JSON.stringify({ type: 'failure', status: 429, data }), {
			headers: { ...headers, 'content-type': 'application/json' }
		});
	}
	return new Response(MESSAGE, { status: 429, headers });
}
