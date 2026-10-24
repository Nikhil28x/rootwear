/**
 * The admin audit log (app.admin_audit_log): writing it, and reading it back
 * for /admin/audit.
 *
 * §12/RW-141: every privileged write is attributable after the fact. A failed
 * audit insert must not silently swallow the write it describes, so
 * writeAudit throws rather than logging quietly.
 */
import { getServiceClient } from '$lib/server/db/clients';

export async function writeAudit(
	actor: string,
	action: string,
	entity: string,
	entityId: string,
	detail: Record<string, unknown> = {}
): Promise<void> {
	const { error } = await getServiceClient()
		.from('admin_audit_log')
		.insert({ actor_email: actor, action, entity, entity_id: entityId, detail });
	if (error) throw new Error(`audit write failed: ${error.message}`);
}

export type AuditEntry = {
	readonly id: string;
	readonly actor: string;
	readonly action: string;
	readonly entity: string;
	readonly entityId: string | null;
	readonly detail: Record<string, unknown>;
	readonly occurredAt: number;
};

export type AuditFilter = {
	readonly actor?: string;
	readonly entity?: string;
	readonly entityId?: string;
	readonly search?: string;
	readonly from?: number;
	readonly to?: number;
};

export const AUDIT_PAGE_SIZE = 50;

type AuditRow = {
	id: string;
	actor_email: string | null;
	action: string;
	entity: string;
	entity_id: string | null;
	detail: Record<string, unknown> | null;
	occurred_at: string;
};

function toEntry(row: AuditRow): AuditEntry {
	return {
		id: row.id,
		actor: row.actor_email ?? 'system',
		action: row.action,
		entity: row.entity,
		entityId: row.entity_id,
		detail: row.detail ?? {},
		occurredAt: Date.parse(row.occurred_at)
	};
}

/** One page of the log, newest first, with the total for the pager. */
export async function listAudit(
	filter: AuditFilter,
	page: number
): Promise<{ entries: AuditEntry[]; total: number }> {
	let query = getServiceClient()
		.from('admin_audit_log')
		.select('id, actor_email, action, entity, entity_id, detail, occurred_at', { count: 'exact' })
		.order('occurred_at', { ascending: false });

	if (filter.actor) query = query.eq('actor_email', filter.actor);
	if (filter.entity) query = query.eq('entity', filter.entity);
	if (filter.entityId) query = query.eq('entity_id', filter.entityId);
	if (filter.search) {
		const term = filter.search.replace(/[%,()]/g, ' ').trim();
		if (term) query = query.or(`action.ilike.*${term}*,entity_id.ilike.*${term}*`);
	}
	if (filter.from) query = query.gte('occurred_at', new Date(filter.from).toISOString());
	if (filter.to) query = query.lte('occurred_at', new Date(filter.to).toISOString());

	const start = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;
	const { data, error, count } = await query.range(start, start + AUDIT_PAGE_SIZE - 1);
	if (error) throw new Error(`audit read failed: ${error.message}`);
	return { entries: ((data ?? []) as AuditRow[]).map(toEntry), total: count ?? 0 };
}

/** The values the filters offer: everyone who has acted, every kind of record. */
export async function auditFacets(): Promise<{ actors: string[]; entities: string[] }> {
	const { data, error } = await getServiceClient()
		.from('admin_audit_log')
		.select('actor_email, entity')
		.order('occurred_at', { ascending: false })
		.limit(2000);
	if (error) throw new Error(`audit read failed: ${error.message}`);
	const rows = (data ?? []) as { actor_email: string | null; entity: string }[];
	return {
		actors: [...new Set(rows.map((r) => r.actor_email ?? 'system'))].sort(),
		entities: [...new Set(rows.map((r) => r.entity))].sort()
	};
}

/** The history of one record, for the timeline on its detail screen. */
export async function auditFor(entity: string, entityId: string, limit = 50): Promise<AuditEntry[]> {
	const { data, error } = await getServiceClient()
		.from('admin_audit_log')
		.select('id, actor_email, action, entity, entity_id, detail, occurred_at')
		.eq('entity', entity)
		.eq('entity_id', entityId)
		.order('occurred_at', { ascending: false })
		.limit(limit);
	if (error) throw new Error(`audit read failed: ${error.message}`);
	return ((data ?? []) as AuditRow[]).map(toEntry);
}
