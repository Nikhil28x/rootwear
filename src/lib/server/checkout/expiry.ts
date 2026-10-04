import { cartRepository } from '$lib/server/cart';
import { orderPaymentWindowMs } from '$lib/server/env';

/**
 * Unpaid orders give their stock back (supabase/migrations/0020).
 *
 * app.commit_order() takes stock when an order is PLACED, not when it is paid,
 * so an abandoned pending_payment order would otherwise hold its pieces for
 * ever. Orders older than ORDER_PAYMENT_WINDOW_MINUTES (default 10) are
 * cancelled and their stock, coupon use and idempotency key released.
 *
 * The cron endpoint (/api/cron/expire-orders) is the real schedule. This also
 * runs opportunistically from the cart and checkout, throttled per process,
 * so a deployment without cron — and dev — stays healthy. A payment captured
 * concurrently always wins; see app.cancel_unpaid_orders().
 */

/** Opportunistic sweeps run at most this often per server process. */
const SWEEP_INTERVAL_MS = 30_000;

let lastSweepMs = 0;

export async function expireUnpaidOrders({ force = false } = {}): Promise<number> {
	const now = Date.now();
	if (!force && now - lastSweepMs < SWEEP_INTERVAL_MS) return 0;
	lastSweepMs = now;

	try {
		const expired = await cartRepository.expireUnpaidOrders(orderPaymentWindowMs());
		if (expired > 0) console.info(`[checkout] expired ${expired} unpaid order(s)`);
		return expired;
	} catch (cause) {
		// Housekeeping must never take a checkout down with it. Cron retries.
		console.error('[checkout] expiring unpaid orders failed', cause);
		return 0;
	}
}
