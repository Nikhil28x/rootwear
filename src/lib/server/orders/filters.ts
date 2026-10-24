/** Reading the orders list's filters from a URL, shared by the list, export and print. */
import { parseIstInput } from '$lib/components/admin/tone';
import { ORDER_STATES, type OrderFilter, type OrderState } from './admin';

const VIEWS = ['to_ship', 'returns', ...ORDER_STATES] as const;

export function readOrderFilter(params: URLSearchParams): {
	filter: OrderFilter;
	raw: Record<string, string>;
} {
	const raw = {
		view: params.get('view') ?? '',
		q: params.get('q') ?? '',
		from: params.get('from') ?? '',
		to: params.get('to') ?? '',
		drop: params.get('drop') ?? ''
	};
	return {
		raw,
		filter: {
			// No view is "to ship", the work waiting; "all" is every paid order.
			state:
				raw.view === ''
					? 'to_ship'
					: (VIEWS as readonly string[]).includes(raw.view)
						? (raw.view as OrderState | 'to_ship' | 'returns')
						: undefined,
			search: raw.q || undefined,
			from: raw.from ? (parseIstInput(`${raw.from}T00:00`) ?? undefined) : undefined,
			to: raw.to ? (parseIstInput(`${raw.to}T23:59`) ?? undefined) : undefined,
			dropId: raw.drop || undefined
		}
	};
}
