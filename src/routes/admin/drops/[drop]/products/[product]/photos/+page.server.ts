import { error, fail } from '@sveltejs/kit';
import type { Actions, RequestEvent } from './$types';
import { requirePermission } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	CatalogueError,
	deleteImage,
	findProduct,
	moveImage,
	restoreImage,
	updateImage,
	uploadImage,
	type AdminImage
} from '$lib/server/catalogue/admin';

const ROLES = ['lead', 'detail', 'fabric', 'worn'] as const;
const role = (value: FormDataEntryValue | null): AdminImage['role'] =>
	(ROLES as readonly string[]).includes(String(value))
		? (String(value) as AdminImage['role'])
		: 'detail';

async function editor(event: RequestEvent) {
	const actor = await staffActor(event);
	requirePermission(actor, 'catalogue.edit');
	const found = await findProduct(event.params.drop, event.params.product);
	if (!found) error(404, 'That product is not in this drop.');
	return { actor: actorLabel(actor), product: found.product };
}

export const actions: Actions = {
	upload: async (event) => {
		const { actor, product } = await editor(event);
		const form = await event.request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length === 0) return fail(400, { error: 'Choose one or more photos to upload.' });

		const alt = String(form.get('alt') ?? '').trim();
		const colourwayId = String(form.get('colourwayId') ?? '') || null;
		const imageRole = role(form.get('role'));
		const problems: string[] = [];
		for (const [i, file] of files.entries()) {
			try {
				await uploadImage({
					productId: product.id,
					file,
					// One description for one photo; numbered when several share it.
					alt: alt
						? files.length > 1
							? `${alt} (${i + 1})`
							: alt
						: `${product.name}, ${imageRole} photo ${product.images.length + i + 1}`,
					role: imageRole,
					colourwayId,
					actor
				});
			} catch (err) {
				if (err instanceof CatalogueError) problems.push(`${file.name}: ${err.message}`);
				else throw err;
			}
		}
		if (problems.length) return fail(400, { error: problems.join(' ') });
		return {
			message: `${files.length} photo${files.length === 1 ? '' : 's'} added.${alt ? '' : ' Check each description below.'}`
		};
	},

	update: async (event) => {
		const { actor } = await editor(event);
		const form = await event.request.formData();
		try {
			await updateImage({
				imageId: String(form.get('imageId') ?? ''),
				alt: String(form.get('alt') ?? ''),
				role: role(form.get('role')),
				caption: String(form.get('caption') ?? '') || null,
				colourwayId: String(form.get('colourwayId') ?? '') || null,
				actor
			});
		} catch (err) {
			if (err instanceof CatalogueError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Photo saved.' };
	},

	move: async (event) => {
		const { product } = await editor(event);
		const form = await event.request.formData();
		await moveImage({
			productId: product.id,
			imageId: String(form.get('imageId') ?? ''),
			direction: form.get('direction') === 'back' ? -1 : 1
		});
		return {};
	},

	remove: async (event) => {
		const { actor } = await editor(event);
		const removed = await deleteImage({
			imageId: String((await event.request.formData()).get('imageId') ?? ''),
			actor
		});
		return { removed };
	},

	restore: async (event) => {
		const { actor, product } = await editor(event);
		const raw = String((await event.request.formData()).get('image') ?? '');
		let image: AdminImage;
		try {
			image = JSON.parse(raw);
		} catch {
			return fail(400, { error: 'Could not restore that photo.' });
		}
		await restoreImage({ productId: product.id, image, actor });
		return { message: 'Photo restored.' };
	}
};
