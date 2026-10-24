/**
 * Values inside PostgREST filter strings (`.or('email.eq.…,phone.eq.…')`).
 *
 * A raw value is parsed as filter syntax: an "email" of `x@y.zz,stage.eq.new`
 * would add a second condition. Double-quoting with backslash escapes makes
 * it a single literal, whatever it contains. Use this for every value that
 * did not come from our own code.
 */
export function literal(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** `column.eq."value"` for use inside an `.or(...)` list. */
export function eq(column: string, value: string): string {
	return `${column}.eq.${literal(value)}`;
}
