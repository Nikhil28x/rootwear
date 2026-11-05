// Shared helpers for the end-to-end runs against the local stack.
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// playwright-core isn't a project dependency: point PLAYWRIGHT_CORE at any
// install of it (or install it next to the repo), and CHROME_PATH at a
// Chromium build if Playwright's own browsers aren't downloaded.
const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5199';
export const ENV = Object.fromEntries(
	readFileSync(new URL('../../.env.e2e', import.meta.url), 'utf8')
		.split('\n')
		.filter((l) => /^[A-Z_]+=/.test(l))
		.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
export const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let pass = 0;
let failures = [];
export function check(name, ok, detail = '') {
	if (ok) pass++;
	else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`);
}
export function summary() {
	console.log(`\n${pass} passed, ${failures.length} failed`);
	for (const f of failures) console.log('  - ' + f);
	return failures.length;
}

/** One SQL statement against the local database, tuples only. */
export function sql(query) {
	return execFileSync(
		process.env.PSQL ?? 'psql',
		[DB, '-XtAq', '-v', 'ON_ERROR_STOP=1', '-c', query],
		{
			encoding: 'utf8'
		}
	).trim();
}

export async function browser() {
	return chromium.launch(
		process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
	);
}

export async function newPage(b, opts = {}) {
	const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', (e) => page.errors.push(String(e)));
	page.on('console', (m) => {
		if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
			page.errors.push(m.text());
	});
	return page;
}

export async function adminLogin(page, email, password, attempt = 1) {
	await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', password);
	await Promise.all([
		page
			.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 15000 })
			.catch(() => {}),
		page.click('button[type=submit]')
	]);
	const ok = !new URL(page.url()).pathname.startsWith('/admin/login');
	// A dev server can reload mid-submit while it compiles a route for the
	// first time; one retry tells that apart from a real refusal.
	if (!ok && attempt === 1) return adminLogin(page, email, password, 2);
	return ok;
}

/** A SvelteKit form action called the way a script (not the page) would. */
export async function action(path, name, fields, { cookie = '', origin = BASE } = {}) {
	const body = new URLSearchParams(fields);
	const res = await fetch(name ? `${BASE}${path}?/${name}` : `${BASE}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin,
			'x-sveltekit-action': 'true',
			cookie
		},
		body,
		redirect: 'manual'
	});
	let json = null;
	const text = await res.text();
	try {
		json = JSON.parse(text);
	} catch {}
	return { status: res.status, json, text };
}

export function cookieHeader(cookies) {
	return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/** A Razorpay webhook body and its signature, as Razorpay would send them. */
export function razorpayWebhook({
	event = 'payment.captured',
	orderId,
	paymentId,
	amount,
	secret
}) {
	const body = JSON.stringify({
		entity: 'event',
		account_id: 'acc_test',
		event,
		contains: ['payment'],
		payload: {
			payment: {
				entity: {
					id: paymentId,
					entity: 'payment',
					amount,
					currency: 'INR',
					status: 'captured',
					order_id: orderId,
					method: 'upi',
					captured: true
				}
			}
		},
		created_at: Math.floor(Date.now() / 1000)
	});
	const signature = createHmac('sha256', secret).update(body).digest('hex');
	return { body, signature };
}
