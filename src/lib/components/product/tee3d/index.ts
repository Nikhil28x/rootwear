/**
 * Mount the 3D hero tee. Imported dynamically, so three.js and the garment
 * never sit on the page's critical path.
 */
import { mountTee, type MountOptions, type TeeScene } from './core';
import { buildGarment } from './garment';

export function mountGarment(
	canvas: HTMLCanvasElement,
	front: HTMLImageElement,
	back: HTMLImageElement,
	options: MountOptions
): Promise<TeeScene> {
	return mountTee(canvas, front, back, buildGarment, options);
}

export type { Side } from './core';
