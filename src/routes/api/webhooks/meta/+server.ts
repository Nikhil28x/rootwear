import type { RequestHandler } from './$types';
import { metaWebhook } from '$lib/server/messaging/config';
import { constantTimeEqual, hmacSha256Hex } from '$lib/server/payments/crypto';
import { processMetaPayload } from '$lib/server/meta/webhook';
import '$lib/server/leads/meta';

/**
 * Meta's webhook: WhatsApp delivery receipts and inbound messages, and lead
 * ads from Facebook and Instagram.
 *
 * GET is Meta's one-time verification handshake: echo hub.challenge when
 * hub.verify_token matches META_VERIFY_TOKEN.
 *
 * POST is signed with the app secret (X-Hub-Signature-256: sha256=<hex> over
 * the raw body). The body is read raw BEFORE parsing, because re-serialised
 * JSON no longer matches the signature. Unsigned or mis-signed deliveries are
 * refused.
 */
export const GET: RequestHandler = ({ url }) => {
	const { verifyToken } = metaWebhook();
	if (!verifyToken) return new Response('webhook is not configured', { status: 503 });

	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token') ?? '';
	const challenge = url.searchParams.get('hub.challenge') ?? '';
	if (mode === 'subscribe' && constantTimeEqual(token, verifyToken)) {
		return new Response(challenge, { status: 200 });
	}
	return new Response('forbidden', { status: 403 });
};

export const POST: RequestHandler = async ({ request }) => {
	const { appSecret } = metaWebhook();
	if (!appSecret) return new Response('webhook is not configured', { status: 503 });

	const raw = await request.text();
	const header = request.headers.get('x-hub-signature-256') ?? '';
	const presented = header.startsWith('sha256=') ? header.slice('sha256='.length) : '';
	const expected = await hmacSha256Hex(appSecret, raw);
	if (!presented || !constantTimeEqual(presented, expected)) {
		return new Response('invalid signature', { status: 401 });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(raw);
	} catch {
		return new Response('invalid json', { status: 400 });
	}

	// Meta retries anything that is not a fast 200, so the work is finished
	// before replying only because it is quick (a few row updates). Failures
	// inside are logged per change rather than failing the delivery.
	await processMetaPayload(payload as Parameters<typeof processMetaPayload>[0]);
	return new Response('ok', { status: 200 });
};
