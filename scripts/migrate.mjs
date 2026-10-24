#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to a database, in order, each file in one
 * transaction. Files already applied are skipped, using the same history table
 * as the Supabase CLI, so `supabase db push` agrees with what ran here.
 *
 *   DATABASE_URL='postgresql://…' node scripts/migrate.mjs           # apply
 *   DATABASE_URL='postgresql://…' node scripts/migrate.mjs --dry-run # list only
 *
 * Needs `psql` on the PATH. For Supabase use the Session pooler string
 * (Connect → Session pooler, port 5432): the direct host is IPv6 only.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');
const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'supabase', 'migrations');

if (!url) {
	console.error('Set DATABASE_URL to the database connection string.');
	process.exit(1);
}

const masked = url.replace(/(\/\/[^:/@]+:)[^@]*@/, '$1••••@');

function psql(args, input) {
	const run = spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
		input,
		encoding: 'utf8'
	});
	if (run.error) {
		console.error(`Could not run psql: ${run.error.message}. Install the PostgreSQL client.`);
		process.exit(1);
	}
	return run;
}

const ready = psql(
	['-tA'],
	`create schema if not exists supabase_migrations;
	 create table if not exists supabase_migrations.schema_migrations (
	   version text primary key, statements text[], name text);
	 select version from supabase_migrations.schema_migrations;`
);
if (ready.status !== 0) {
	console.error(`Could not connect to ${masked}\n${ready.stderr.trim()}`);
	process.exit(1);
}

const applied = new Set(ready.stdout.split('\n').filter(Boolean));
const files = readdirSync(dir)
	.filter((f) => /^\d+_.+\.sql$/.test(f))
	.sort();
const pending = files.filter((f) => !applied.has(f.split('_')[0]));

console.log(`Database: ${masked}`);
console.log(`${files.length - pending.length} already applied, ${pending.length} to apply.`);
if (dryRun) {
	for (const f of pending) console.log(`  would apply ${f}`);
	process.exit(0);
}

for (const file of pending) {
	const [version, ...rest] = basename(file, '.sql').split('_');
	const name = rest.join('_').replace(/'/g, "''");
	const run = psql([
		'--single-transaction',
		'-f',
		join(dir, file),
		'-c',
		`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}')`
	]);
	if (run.status !== 0) {
		console.error(`  ${file} failed, so it and everything after it were not applied:`);
		console.error(run.stderr.trim());
		process.exit(1);
	}
	console.log(`  applied ${file}`);
}
console.log('Done.');
