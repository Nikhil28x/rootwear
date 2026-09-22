/**
 * Email normalisation for the demand forms.
 *
 * Normalising BEFORE the insert is what makes the unique constraints actually
 * hold: "Aaron@Example.com " and "aaron@example.com" are the same person, and
 * without trimming and lower-casing they would take two rows and count twice
 * on the demand board.
 *
 * The pattern is deliberately loose. Over-strict email regexes reject valid
 * addresses, and the real proof an address works is that mail reaches it.
 */
const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
	return value.length <= 254 && SHAPE.test(value);
}
