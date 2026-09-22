/**
 * HMAC and constant-time comparison, on the WEB CRYPTO API.
 *
 * Deliberately not `node:crypto`. Two reasons, and the second is the one that
 * matters: this project has no @types/node, so a Node import does not
 * typecheck; and adapter-auto may put these routes on an edge runtime where
 * `node:crypto` and `Buffer` do not exist at all. `crypto.subtle` is present
 * on every runtime SvelteKit targets, so the webhook verifies the same way
 * everywhere.
 *
 * The cost is that signing is asynchronous, which is why `verifySignature` and
 * `verifyWebhookSignature` return promises on the PaymentProvider interface.
 */

const encoder = new TextEncoder();

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'));

function toHex(buffer: ArrayBuffer): string {
	let out = '';
	for (const byte of new Uint8Array(buffer)) out += HEX[byte];
	return out;
}

/** HMAC-SHA256, hex encoded — the format both Razorpay signatures use. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Constant-time string comparison.
 *
 * A plain `===` on a signature leaks, through timing, how many leading
 * characters were right — which is enough to forge one given enough attempts.
 * The loop below always runs to the longer length and never breaks early, and
 * the length difference itself is folded into the accumulator rather than
 * returned as an early exit.
 */
export function constantTimeEqual(a: string, b: string): boolean {
	const left = encoder.encode(a);
	const right = encoder.encode(b);

	let difference = left.length ^ right.length;
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference === 0;
}

/** Base64, for HTTP Basic auth. ASCII only, which every API key is. */
export function base64(value: string): string {
	return btoa(value);
}

/** 32 random bytes, hex. The same primitive the cart token uses. */
export function randomHex(bytes = 16): string {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	let out = '';
	for (const byte of buffer) out += HEX[byte];
	return out;
}
