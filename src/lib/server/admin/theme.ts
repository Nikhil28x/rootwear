/**
 * The admin theme choice: light, dark, or follow the system. Kept in a cookie
 * so the server renders the right one and there is no flash on load.
 */
import type { Cookies } from '@sveltejs/kit';

export type ThemeChoice = 'system' | 'light' | 'dark';

const COOKIE = 'rw_admin_theme';

export function readTheme(cookies: Cookies): ThemeChoice {
	const value = cookies.get(COOKIE);
	return value === 'light' || value === 'dark' ? value : 'system';
}

export function writeTheme(cookies: Cookies, choice: ThemeChoice): void {
	cookies.set(COOKIE, choice, {
		path: '/admin',
		httpOnly: false,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 60 * 24 * 365
	});
}
