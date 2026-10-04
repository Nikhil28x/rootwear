import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * The review step is part of the one-page checkout now. Old links and
 * bookmarks land on it rather than a 404.
 */
export const GET: RequestHandler = () => redirect(303, '/checkout/information');
