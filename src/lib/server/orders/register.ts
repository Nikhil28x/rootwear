/** Reading the invoice register's filters, shared by the screen and its export. */
import { parseIstInput } from '$lib/components/admin/tone';

export function readRegisterFilter(params: URLSearchParams) {
	const raw = {
		kind: params.get('kind') ?? '',
		q: params.get('q') ?? '',
		from: params.get('from') ?? '',
		to: params.get('to') ?? ''
	};
	return {
		raw,
		filter: {
			kind: raw.kind === 'invoice' || raw.kind === 'credit_note' ? (raw.kind as 'invoice' | 'credit_note') : undefined,
			search: raw.q || undefined,
			from: raw.from ? (parseIstInput(`${raw.from}T00:00`) ?? undefined) : undefined,
			to: raw.to ? (parseIstInput(`${raw.to}T23:59`) ?? undefined) : undefined
		}
	};
}
