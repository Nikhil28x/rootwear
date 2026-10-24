/**
 * Reading the product form. Prices are typed in rupees and stored in paise;
 * the conversion happens here, once, so nothing downstream sees rupees.
 */
import type { ProductInput } from './admin';

function text(form: FormData, name: string): string {
	return String(form.get(name) ?? '').trim();
}

/** "1,299" or "1299.00" rupees → 129900 paise; NaN if it is not a price. */
export function rupeesToPaise(value: string): number {
	const cleaned = value.replace(/[₹,\s]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
	return Math.round(Number(cleaned) * 100);
}

export function readProductForm(form: FormData): { input: ProductInput; values: Record<string, string> } {
	const values = Object.fromEntries(
		[
			'name',
			'summary',
			'fabric',
			'gsm',
			'fit',
			'fitNote',
			'care',
			'modelHeightCm',
			'modelWornSize',
			'styleCode',
			'launchPrice',
			'prelaunchPrice',
			'hsnCode',
			'gstRate'
		].map((name) => [name, text(form, name)])
	);

	const launchPrice = rupeesToPaise(values.launchPrice);
	const prelaunch = values.prelaunchPrice ? rupeesToPaise(values.prelaunchPrice) : launchPrice;

	return {
		values,
		input: {
			name: values.name,
			summary: values.summary,
			fabric: values.fabric,
			gsm: Number(values.gsm),
			care: values.care.split('\n'),
			fit: values.fit,
			fitNote: values.fitNote || null,
			modelHeightCm: values.modelHeightCm ? Number(values.modelHeightCm) : null,
			modelWornSize: values.modelWornSize || null,
			styleCode: values.styleCode.toUpperCase(),
			launchPrice,
			prelaunchPrice: prelaunch,
			hsnCode: values.hsnCode || '6109',
			gstRate: values.gstRate === '' ? 5 : Number(values.gstRate)
		}
	};
}
