/**
 * Responsive photographs. A photo exported by the image pipeline is published
 * at a ladder of widths, named `<name>-<width>.webp`, and the data points at
 * the widest. This turns that one URL back into a srcset, so a phone is sent
 * the 640 and a wide desktop the 1600 (or 2400). Any other URL — the cutout
 * PNG, a JPG — has no ladder and gets no srcset.
 */
const LADDER = [640, 1080, 1600, 2400];

export function srcsetOf(url: string | null | undefined): string | undefined {
	const match = url?.match(/^(.*)-(\d+)\.webp$/);
	if (!match) return undefined;
	const [, base, widest] = match;
	return LADDER.filter((width) => width <= Number(widest))
		.map((width) => `${base}-${width}.webp ${width}w`)
		.join(', ');
}

/**
 * A cutout: the garment on transparency (a laid-flat piece), rather than a
 * photograph. Old cutouts are PNGs; current ones are WebPs named "…cutout…".
 * Pages show cutouts with `contain` and keep them out of photo strips.
 */
export function isCutout(url: string | null | undefined): boolean {
	return !!url && (url.endsWith('.png') || /cutout[^/]*$/.test(url));
}
