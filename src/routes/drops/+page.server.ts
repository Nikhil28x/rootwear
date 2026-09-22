import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { demand } from '$lib/server/demand';
import { handleRequestDrop } from '$lib/server/demand/actions';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import type { ArchiveCard } from '$lib/components/drop/types';
import type { Drop } from '$lib/domain/drop';

/**
 * RW-026 — §03 template 03: the drop archive. "The index of every drop
 * released, with dates, sold-out marks and cover art. The proof-of-history
 * page." §06: "Nothing is ever deleted; the archive is the brand's proof of
 * history." So every drop is listed, in every state, newest first.
 *
 * The page is split in two because that is how it is read, not because the
 * data is: the drop that is growing now sits at the top, and the history sits
 * under it with a request form on each finished drop (§12 — the demand board
 * is "the input to the next cut and to any re-drop").
 */

/** Cover art: the lead shot if the product has one, else whatever exists. */
function coverOf(drop: Drop) {
	for (const product of drop.products) {
		const lead = product.images.find((image) => image.role === 'lead');
		if (lead) return { url: lead.url, alt: lead.alt };
	}
	const first = drop.products[0]?.images[0];
	return first ? { url: first.url, alt: first.alt } : null;
}

/**
 * Size options for the request form. Labelled with the product name only when
 * the drop has more than one piece — "Tee — M" on a single-product drop is
 * noise, and §09 allows exactly one variant axis so the size is the choice.
 */
function sizeOptionsOf(drop: Drop) {
	const many = drop.products.length > 1;
	return drop.products.flatMap((product) =>
		product.variants.map((variant) => ({
			value: variant.id,
			label: many ? `${product.name} — ${variant.size}` : variant.size
		}))
	);
}

function toCard(drop: Drop): ArchiveCard {
	return {
		slug: drop.slug,
		number: drop.number,
		name: drop.name,
		state: drop.state,
		story: drop.story,
		// §06: archived drops are "dated as released" — the archive date when it
		// has one, otherwise the instant the drop opened.
		releasedAt: drop.archivedAt ?? drop.launchInstant,
		editionSize: drop.editionSize,
		cover: coverOf(drop),
		canRequest: acceptsDropRequest(drop.state),
		sizeOptions: sizeOptionsOf(drop)
	};
}

/**
 * §07 — real, live, never fabricated. Read straight off the demand board and
 * shown only when there is something to show: "0 people have asked" is not a
 * fact worth printing, and printing it would invite rounding it up later.
 */
async function demandSummary(dropId: string) {
	const rows = await demand.demandForDrop(dropId);
	const total = rows.reduce((sum, row) => sum + row.requests, 0);
	if (total === 0) return null;
	const top = rows.reduce((best, row) => (row.requests > best.requests ? row : best), rows[0]);
	return { total, topSize: top.requests > 0 ? top.size : null };
}

export const load: PageServerLoad = async () => {
	const all = await drops.listDrops();

	// listDrops() already returns newest first; sorting again here would be a
	// second opinion about chronology and the repository owns that.
	const cards = all.map(toCard);

	// The drop that is alive: the newest one that has not finished. A finished
	// drop belongs under the history, not at the top of the page.
	const growing = all.find((drop) => !isFinished(drop.state)) ?? null;
	const past = all.filter((drop) => isFinished(drop.state));

	const history = await Promise.all(
		past.map(async (drop) => ({
			card: toCard(drop),
			demand: await demandSummary(drop.id)
		}))
	);

	return {
		cards,
		growing: growing ? toCard(growing) : null,
		history
	};
};

export const actions: Actions = {
	/** §12 — "bring this drop back, in this size". No money, one row per size. */
	requestDrop: (event) => handleRequestDrop(event, 'drop_archive')
};
