#!/usr/bin/env node
/**
 * Create (or update) a staff account.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_ROLE=owner node scripts/create-admin.mjs
 *
 * Reads credentials from the environment so no password is ever committed.
 * Uses the service-role key, which bypasses RLS — server-side only, never run
 * this from anything the browser can reach.
 *
 * §12: 'owner' = full access (Aaron). 'layout' = pages, banners, copy and
 * navigation only, with no access to orders, customer records or payouts.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// Load .env without adding a dependency.
if (existsSync('.env')) {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
	}
}

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const role = process.env.ADMIN_ROLE ?? 'owner';

const missing = Object.entries({
	PUBLIC_SUPABASE_URL: url,
	SUPABASE_SERVICE_ROLE_KEY: serviceKey,
	ADMIN_EMAIL: email,
	ADMIN_PASSWORD: password
})
	.filter(([, v]) => !v)
	.map(([k]) => k);

if (missing.length) {
	console.error(`Missing: ${missing.join(', ')}\nSee .env.example.`);
	process.exit(1);
}

if (password.length < 10) {
	console.warn(
		`\n  WARNING: that password is ${password.length} characters.\n` +
			`  This account can read every customer record and every payout.\n` +
			`  Use something long before this touches production.\n`
	);
}

const admin = createClient(url, serviceKey, {
	auth: { persistSession: false, autoRefreshToken: false }
});

const { data: list } = await admin.auth.admin.listUsers();
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId;
if (existing) {
	const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password });
	if (error) throw error;
	userId = data.user.id;
	console.log(`Updated password for ${email}`);
} else {
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (error) throw error;
	userId = data.user.id;
	console.log(`Created ${email}`);
}

const { error: roleError } = await admin.schema('app').rpc('grant_staff_role', {
	p_email: email,
	p_role: role
});

if (roleError) {
	// The RPC lives in the app schema; fall back to a direct upsert.
	const { error: upsertError } = await admin
		.schema('app')
		.from('staff')
		.upsert({ user_id: userId, role }, { onConflict: 'user_id' });
	if (upsertError) throw upsertError;
}

console.log(`Granted role "${role}" to ${email}`);
