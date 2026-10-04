/**
 * RW-018 — Typed server environment.
 *
 * Uses $env/dynamic/private, so values are read at runtime rather than frozen
 * at build time: the app builds and runs with no database configured, which is
 * what keeps the mock catalogue path working.
 *
 * This module lives under src/lib/server, so SvelteKit refuses to bundle it
 * into client code. Nothing here may ever be re-exported from a shared module.
 */
import { env } from '$env/dynamic/private';

function optional(name: string): string | undefined {
	const value = env[name];
	return value && value.length > 0 ? value : undefined;
}

/** Throws at the point of use, not at import, so unconfigured routes stay dead. */
export function required(name: string): string {
	const value = optional(name);
	if (!value) {
		throw new Error(
			`Missing required environment variable ${name}. ` +
				`Copy .env.example to .env and fill it in.`
		);
	}
	return value;
}

export const SUPABASE_URL = () => required('PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = () => required('PUBLIC_SUPABASE_ANON_KEY');

/** BYPASSES RLS. Server-only, and only for the paths that genuinely need it. */
export const SUPABASE_SERVICE_ROLE_KEY = () => required('SUPABASE_SERVICE_ROLE_KEY');

export const CRON_SECRET = () => required('CRON_SECRET');

/** The cron secret when set, or undefined — for endpoints that refuse rather than throw. */
export const optionalCronSecret = () => optional('CRON_SECRET');

/** Default window an order may sit unpaid before its stock goes back on sale. */
const DEFAULT_PAYMENT_WINDOW_MINUTES = 10;

/**
 * How long a pending_payment order holds its stock, in ms.
 * ORDER_PAYMENT_WINDOW_MINUTES, default 10. Fractions are accepted (handy for
 * testing); anything unparseable or negative falls back to the default.
 */
export function orderPaymentWindowMs(): number {
	const raw = optional('ORDER_PAYMENT_WINDOW_MINUTES');
	const minutes = raw === undefined ? NaN : Number(raw);
	const value = Number.isFinite(minutes) && minutes >= 0 ? minutes : DEFAULT_PAYMENT_WINDOW_MINUTES;
	return Math.round(value * 60_000);
}

/**
 * RW-046 — one environment variable switches the catalogue between the mock
 * fixtures and Postgres, with no other code change.
 */
export function catalogueSource(): 'mock' | 'supabase' {
	const requested = optional('CATALOGUE_SOURCE');
	if (requested === 'mock' || requested === 'supabase') return requested;

	// Once the three backend values exist, live storage is the default. Mock
	// mode remains available as an explicit local override.
	return isBackendConfigured() ? 'supabase' : 'mock';
}

export function isSupabaseConfigured(): boolean {
	return Boolean(optional('PUBLIC_SUPABASE_URL') && optional('PUBLIC_SUPABASE_ANON_KEY'));
}

export function isBackendConfigured(): boolean {
	return Boolean(isSupabaseConfigured() && optional('SUPABASE_SERVICE_ROLE_KEY'));
}
