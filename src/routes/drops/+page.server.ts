import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { demand } from '$lib/server/demand';
import { handleRequestDrop } from '$lib/server/demand/actions';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import type { ArchiveCard } from '$lib/components/drop/types';
import type { Drop } from '$lib/domain/drop';
import { resolveStage } from '$lib/drop/stage-resolver';
import { STAGE_COUNT, STAGE_DURATION_MS } from '$lib/drop/schedule';

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

/**
 * The growth clock for ONE drop, built from that drop's own launch instant.
 *
 * Deliberately not DROP_01_SCHEDULE: that constant hardcodes Drop 01's
 * instant, so reusing it here would count every drop down to Drop 01's launch.
 * Mirrors the admin route, which already builds a schedule per record.
 *
 * `drop.launchInstant`, never the card's `releasedAt` — releasedAt is
 * `archivedAt ?? launchInstant`, so on an archived drop it is the date the
 * drop came DOWN, and a countdown against it would be quietly wrong.
 */
function stageFor(drop: Drop, now: number) {
	return resolveStage(
		{
			teaseStart: drop.launchInstant - STAGE_COUNT * STAGE_DURATION_MS,
			launchInstant: drop.launchInstant,
			stageCount: STAGE_COUNT,
			stageDurationMs: STAGE_DURATION_MS
		},
		now
	);
}

export const load: PageServerLoad = async ({ locals }) => {
	const all = await drops.listDrops();

	// listDrops() already returns newest first; sorting again here would be a
	// second opinion about chronology and the repository owns that.
	//
	// One card per drop, and nothing else. The page used to also compute a
	// "growing now" highlight and a separate history with demand summaries,
	// which listed every drop up to three times on one screen.
	/**
	 * The drop the archive leads with. listDrops() is newest-first, so that is
	 * simply the head of the list.
	 *
	 * Shown whatever its state, not only while it is counting down. The
	 * component already carries both readings: before the launch instant it is
	 * a countdown with digits, and after it the digits fall away and it becomes
	 * the "it is here" hero. Gating it on a pre-launch state the way the drop
	 * page does would render nothing at all today, because Drop 01 is LIVE.
	 *
	 * Its identity travels with it. The component used to name the drop and its
	 * launch date from module constants, which happened to be right only
	 * because Drop 01's instant IS that constant.
	 */
	const lead = all[0];

	return {
		cards: all.map(toCard),
		feature: lead
			? {
					slug: lead.slug,
					name: lead.name,
					number: lead.number,
					editionSize: lead.editionSize,
					launchInstant: lead.launchInstant,
					// §04 — resolved on the server clock. Never the visitor's.
					stage: stageFor(lead, locals.now)
				}
			: null,
		// Card copy says "Opens" or "Was live" depending on the drop's instant,
		// so it needs the request clock rather than the visitor's (§04).
		now: locals.now
	};
};

export const actions: Actions = {
	/** §12 — "bring this drop back, in this size". No money, one row per size. */
	requestDrop: (event) => handleRequestDrop(event, 'drop_archive')
};
