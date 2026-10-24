/**
 * RW-021 — the shared guard on scheduled-job endpoints.
 *
 * CRON_SECRET as a bearer token (`Authorization: Bearer <secret>`, which is
 * what Vercel Cron sends). Unset secret → 503: an unprotected job endpoint is
 * refused rather than left open. Returns the refusal, or null to proceed.
 */
import { optionalCronSecret } from '$lib/server/env';
import { constantTimeEqual } from '$lib/server/payments/crypto';

export function refuseCron(request: Request): Response | null {
	const secret = optionalCronSecret();
	if (!secret) return new Response('cron is not configured', { status: 503 });

	const header = request.headers.get('authorization') ?? '';
	const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
	if (!presented || !constantTimeEqual(presented, secret)) {
		return new Response('unauthorized', { status: 401 });
	}
	return null;
}
