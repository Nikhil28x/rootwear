/**
 * Staff accounts: who can sign in to admin, and what each person may do.
 *
 * An account is two rows: a Supabase Auth user (the password) and an
 * app.staff row (the membership and permissions). Inviting creates both;
 * removing deletes only the membership, so a person who is also a customer
 * keeps their customer account.
 *
 * The database refuses to remove or demote the last active owner
 * (app.guard_last_owner, 0022). That refusal surfaces here as a StaffError
 * with a sentence the screen can show as-is.
 */
import { isPermissionKey, type PermissionKey } from '$lib/admin/permissions';
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from './audit';

export class StaffError extends Error {}

export type StaffRow = {
	readonly userId: string;
	readonly email: string;
	readonly name: string | null;
	readonly isOwner: boolean;
	readonly permissions: readonly PermissionKey[];
	readonly active: boolean;
	readonly invitedBy: string | null;
	readonly lastSeenAt: number | null;
	readonly createdAt: number;
};

type Row = {
	user_id: string;
	email: string | null;
	display_name: string | null;
	is_owner: boolean;
	permissions: string[] | null;
	active: boolean;
	invited_by: string | null;
	last_seen_at: string | null;
	created_at: string;
};

const COLUMNS =
	'user_id, email, display_name, is_owner, permissions, active, invited_by, last_seen_at, created_at';

function toStaff(row: Row): StaffRow {
	return {
		userId: row.user_id,
		email: row.email ?? '',
		name: row.display_name,
		isOwner: row.is_owner,
		permissions: (row.permissions ?? []).filter(isPermissionKey),
		active: row.active,
		invitedBy: row.invited_by,
		lastSeenAt: row.last_seen_at ? Date.parse(row.last_seen_at) : null,
		createdAt: Date.parse(row.created_at)
	};
}

/** Turns the last-owner trigger's refusal into a sentence for the screen. */
function friendly(message: string): never {
	if (message.includes('At least one active owner')) {
		throw new StaffError(
			'At least one active owner must remain. Make someone else an owner first.'
		);
	}
	throw new Error(message);
}

export async function listStaff(): Promise<StaffRow[]> {
	const { data, error } = await getServiceClient()
		.from('staff')
		.select(COLUMNS)
		.order('created_at', { ascending: true });
	if (error) throw new Error(`staff read failed: ${error.message}`);
	return ((data ?? []) as Row[]).map(toStaff);
}

export async function findStaff(userId: string): Promise<StaffRow | null> {
	const { data, error } = await getServiceClient()
		.from('staff')
		.select(COLUMNS)
		.eq('user_id', userId)
		.maybeSingle();
	if (error) throw new Error(`staff read failed: ${error.message}`);
	return data ? toStaff(data as Row) : null;
}

/** A readable one-time password: no 0/O or 1/l to misread when copied. */
export function temporaryPassword(): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
	return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

/** app.staff.role is a legacy label now; the permissions are what grant access. */
function roleLabel(isOwner: boolean, permissions: readonly PermissionKey[]): string {
	if (isOwner) return 'owner';
	return permissions.length === 1 && permissions[0] === 'layout.edit' ? 'layout' : 'staff';
}

function cleanPermissions(permissions: readonly string[]): PermissionKey[] {
	return [...new Set(permissions.filter(isPermissionKey))];
}

/**
 * Adds a person. Creates their Auth user with a temporary password, or reuses
 * the existing one when the email already has an account. Returns the
 * password so the screen can show it once; it is never stored by the app.
 */
export async function inviteStaff(input: {
	email: string;
	name: string | null;
	isOwner: boolean;
	permissions: readonly string[];
	actor: string;
}): Promise<{ userId: string; password: string | null }> {
	const client = getServiceClient();
	const email = input.email.trim().toLowerCase();

	const { data: list, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
	if (listError) throw new Error(`auth read failed: ${listError.message}`);
	const existing = list.users.find((user) => user.email?.toLowerCase() === email);

	const already = existing ? await findStaff(existing.id) : null;
	if (already?.active) throw new StaffError(`${email} is already on the team.`);

	let userId: string;
	let password: string | null = null;
	if (existing) {
		userId = existing.id;
	} else {
		password = temporaryPassword();
		const { data, error } = await client.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { name: input.name ?? undefined }
		});
		if (error || !data.user) throw new Error(`could not create the account: ${error?.message}`);
		userId = data.user.id;
	}

	const permissions = input.isOwner ? [] : cleanPermissions(input.permissions);
	const { error } = await client.from('staff').upsert(
		{
			user_id: userId,
			email,
			display_name: input.name,
			role: roleLabel(input.isOwner, permissions),
			is_owner: input.isOwner,
			permissions,
			active: true,
			invited_by: input.actor
		},
		{ onConflict: 'user_id' }
	);
	if (error) throw new Error(`staff write failed: ${error.message}`);

	await writeAudit(input.actor, 'staff added', 'staff', userId, {
		email,
		isOwner: input.isOwner,
		permissions
	});
	return { userId, password };
}

export async function updateStaff(input: {
	userId: string;
	name: string | null;
	isOwner: boolean;
	permissions: readonly string[];
	active: boolean;
	actor: string;
}): Promise<void> {
	const before = await findStaff(input.userId);
	if (!before) throw new StaffError('That person is no longer on the team.');

	const permissions = input.isOwner ? [] : cleanPermissions(input.permissions);
	const { error } = await getServiceClient()
		.from('staff')
		.update({
			display_name: input.name,
			is_owner: input.isOwner,
			role: roleLabel(input.isOwner, permissions),
			permissions,
			active: input.active
		})
		.eq('user_id', input.userId);
	if (error) friendly(error.message);

	await writeAudit(input.actor, 'staff updated', 'staff', input.userId, {
		email: before.email,
		before: { isOwner: before.isOwner, permissions: before.permissions, active: before.active },
		after: { isOwner: input.isOwner, permissions, active: input.active }
	});
}

/** Removes the membership. The Auth user stays, in case they are a customer. */
export async function removeStaff(userId: string, actor: string): Promise<void> {
	const before = await findStaff(userId);
	if (!before) return;
	const { error } = await getServiceClient().from('staff').delete().eq('user_id', userId);
	if (error) friendly(error.message);
	await writeAudit(actor, 'staff removed', 'staff', userId, { email: before.email });
}

/** Issues a new temporary password, shown once to whoever reset it. */
export async function resetStaffPassword(userId: string, actor: string): Promise<string> {
	const password = temporaryPassword();
	const { error } = await getServiceClient().auth.admin.updateUserById(userId, { password });
	if (error) throw new Error(`password reset failed: ${error.message}`);
	await writeAudit(actor, 'password reset', 'staff', userId);
	return password;
}

/** A person changing their own password from /admin/account. */
export async function setOwnPassword(userId: string, password: string): Promise<void> {
	const { error } = await getServiceClient().auth.admin.updateUserById(userId, { password });
	if (error) throw new Error(`password change failed: ${error.message}`);
	await writeAudit('self', 'password changed', 'staff', userId);
}

export async function setOwnName(userId: string, name: string | null): Promise<void> {
	const { error } = await getServiceClient()
		.from('staff')
		.update({ display_name: name })
		.eq('user_id', userId);
	if (error) throw new Error(`staff write failed: ${error.message}`);
}

/** Best effort: a failed timestamp must never block a sign-in. */
export async function recordSignIn(userId: string): Promise<void> {
	try {
		await getServiceClient()
			.from('staff')
			.update({ last_seen_at: new Date().toISOString() })
			.eq('user_id', userId);
	} catch {
		// The sign-in itself succeeded; the "last seen" column is informational.
	}
}
