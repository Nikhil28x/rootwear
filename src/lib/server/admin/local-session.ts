import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { isSupabaseConfigured } from '$lib/server/env';

const COOKIE = 'rw_admin_local';
const MAX_AGE_SECONDS = 8 * 60 * 60;

type LocalConfig = {
	loginId: string;
	password: string;
	secret: string;
};

function config(): LocalConfig | null {
	if (isSupabaseConfigured()) return null;

	const loginId = env.ADMIN_LOGIN_ID || (dev ? 'admin@rootwear' : '');
	const password = env.ADMIN_PASSWORD || (dev ? 'rootwear' : '');
	const secret = env.ADMIN_SESSION_SECRET || (dev ? 'rootwear-local-development-session' : '');
	return loginId && password && secret ? { loginId, password, secret } : null;
}

function sameText(left: string, right: string): boolean {
	const a = new TextEncoder().encode(left);
	const b = new TextEncoder().encode(right);
	let difference = a.length ^ b.length;
	const length = Math.max(a.length, b.length);
	for (let index = 0; index < length; index += 1) {
		difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
	}
	return difference === 0;
}

async function signature(payload: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function localAdminAvailable(): boolean {
	return config() !== null;
}

export function localAdminLoginId(): string {
	return config()?.loginId ?? env.ADMIN_LOGIN_ID ?? 'admin@rootwear';
}

export function verifyLocalAdmin(loginId: string, password: string): boolean {
	const values = config();
	if (!values) return false;
	return sameText(loginId.trim().toLowerCase(), values.loginId.toLowerCase()) &&
		sameText(password, values.password);
}

export async function setLocalAdminSession(cookies: Cookies): Promise<void> {
	const values = config();
	if (!values) throw new Error('Local admin credentials are not configured.');
	const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
	const payload = `${values.loginId}|${expires}`;
	cookies.set(COOKIE, `${payload}|${await signature(payload, values.secret)}`, {
		path: '/admin',
		httpOnly: true,
		sameSite: 'strict',
		secure: !dev,
		maxAge: MAX_AGE_SECONDS
	});
}

export async function readLocalAdminSession(cookies: Cookies): Promise<string | null> {
	const values = config();
	const token = cookies.get(COOKIE);
	if (!values || !token) return null;

	const parts = token.split('|');
	if (parts.length !== 3) return null;
	const [loginId, expiresRaw, received] = parts;
	const payload = `${loginId}|${expiresRaw}`;
	const expires = Number(expiresRaw);
	if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return null;
	if (!sameText(received, await signature(payload, values.secret))) return null;
	return sameText(loginId.toLowerCase(), values.loginId.toLowerCase()) ? loginId : null;
}

export function clearLocalAdminSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/admin' });
}
