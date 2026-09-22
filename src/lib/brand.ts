/**
 * Brand constants that cannot be expressed as CSS tokens.
 *
 * The palette itself lives in @theme in src/routes/layout.css. This exists for
 * the handful of places that need a literal — a <meta> attribute cannot read a
 * CSS custom property — so there is still exactly one source of truth.
 */

/** Matches --color-forest in layout.css. */
export const BRAND_THEME_COLOR = '#1f382a';
