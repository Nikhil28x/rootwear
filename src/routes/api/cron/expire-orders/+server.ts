import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cartRepository } from '$lib/server/cart';
import { optionalCronSecret, orderPaymentWindowMs } from '$lib/server/env';
import { constantTimeEqual } from '$lib/server/payments/crypto';

/**
 * RW-021 — the scheduled sweep that gives unpaid orders' stock back.
 *
 * Cancels every pending_payment order older than ORDER_PAYMENT_WINDOW_MINUTES
 * (default 30) through app.expire_unpaid_orders(): stock back, coupon use and
 * idempotency key released, and a payment captured concurrently always wins.
 * Idempotent, so an overlapping or repeated run is harmless.
 *
 * Protected by CRON_SECRET as a bearer token — `Authorization: Bearer <secret>`,
 * which is what Vercel Cron sends. Unset secret → 503: an unprotected sweep
 * endpoint is refused rather than left open.
 *
 * Checkout also sweeps opportunistically ($lib/server/checkout/expiry.ts), so
 * this schedule is about keeping stock honest between visits, not correctness.
 */
async function sweep(request: Request): Promise<Response> {
	const secret = optionalCronSecret();
	if (!secret) return new Response('cron is not configured', { status: 503 });

	const header = request.headers.get('authorization') ?? '';
	const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
	if (!presented || !constantTimeEqual(presented, secret)) {
		return new Response('unauthorized', { status: 401 });
	}

	const windowMs = orderPaymentWindowMs();
	const expired = await cartRepository.expireUnpaidOrders(windowMs);
	return json({ expired, windowMinutes: windowMs / 60_000 });
}

export const GET: RequestHandler = ({ request }) => sweep(request);
export const POST: RequestHandler = ({ request }) => sweep(request);
