/**
 * RW-033 / RW-077 — §14 claims guardrail.
 *
 * "HEMP AND SUSTAINABILITY CLAIMS STAY PROVABLE. The fabric composition and
 * GSM are facts and may be stated. NOTHING carbon-neutral, NOTHING eco-
 * certified, NO unsupported environmental claim anywhere on the site,
 * including in campaign copy and ALT TEXT."
 *
 * §18 launch gate: "No unprovable environmental claim anywhere on the site,
 * alt text included." RW-082 automates this into a content audit; until then
 * RW-061 runs it by hand against these terms.
 */

/** Terms that must not appear in any user-facing string, including alt text. */
export const BANNED_CLAIM_TERMS: readonly string[] = [
	'carbon neutral',
	'carbon-neutral',
	'net zero',
	'net-zero',
	'climate positive',
	'eco-certified',
	'eco certified',
	'eco-friendly',
	'environmentally friendly',
	'sustainably made',
	'sustainable fashion',
	'saves water',
	'water saved',
	'water kept in the ground',
	'plastic fibre avoided',
	'biodegradable',
	'compostable',
	'zero waste',
	'zero-waste',
	'chemical free',
	'chemical-free',
	'toxin free',
	'non-toxic'
];

/**
 * What we ARE allowed to state, because each is a verifiable property of the
 * garment rather than a claim about its effect on the world (§14, §09).
 */
export const PROVABLE_FACTS = [
	{ value: '30/70', unit: '', label: 'hemp to cotton, by composition' },
	{ value: '180', unit: 'GSM', label: 'fabric weight' },
	{ value: '25', unit: '', label: 'hand-numbered pieces in this drop' },
	{ value: '05', unit: '', label: 'sizes, cut unisex' }
] as const;

/** Case-insensitive scan used by the audit script and the launch gate. */
export function findBannedClaims(text: string): string[] {
	const haystack = text.toLowerCase();
	return BANNED_CLAIM_TERMS.filter((term) => haystack.includes(term));
}
