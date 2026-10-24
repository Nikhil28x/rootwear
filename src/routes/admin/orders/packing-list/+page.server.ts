import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { getOrder, listOrders } from '$lib/server/orders/admin';

/**
 * §11: Aaron ships the pieces himself. Everything waiting to go out, oldest
 * first, with the pieces to pick, and one click to print the whole batch.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'fulfilment');
	const { orders } = await listOrders({ state: 'to_ship' }, 1, { all: true });
	const details = await Promise.all(
		[...orders]
			.reverse()
			.slice(0, 100)
			.map((o) => getOrder(o.id))
	);
	return {
		orders: details
			.filter((o) => o !== null)
			.map((o) => ({
				id: o.id,
				number: o.number,
				state: o.state,
				name: o.shipTo.name,
				city: `${o.shipTo.city} ${o.shipTo.pincode}`,
				createdAt: o.createdAt,
				note: o.customerNote,
				isPreOrder: o.isPreOrder,
				lines: o.lines.map((l) => ({
					name: l.name,
					variant: l.variant,
					quantity: l.quantity,
					pieceNumber: l.pieceNumber
				}))
			}))
	};
};
