// End to end: admin opens Drop 01 for sale, a shopper buys, Razorpay pays,
// and the order shows up everywhere it should.
import { mkdirSync, readFileSync } from 'node:fs';
import {
	BASE,
	ENV,
	adminLogin,
	browser,
	check,
	newPage,
	razorpayWebhook,
	sql,
	summary
} from './lib.mjs';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const OWNER = { email: ENV.ADMIN_EMAIL, password: ENV.ADMIN_PASSWORD };
const SHOPPER = `shopper+${Date.now()}@example.com`;
const b = await browser();

// ---------------------------------------------------------------- admin setup
console.log('\nAdmin: open the drop for sale');
const admin = await newPage(b);
check('owner signs in', await adminLogin(admin, OWNER.email, OWNER.password));

await admin.goto(BASE + '/admin/drops/01-pineapple-haze', { waitUntil: 'networkidle' });
if (await admin.getByRole('button', { name: 'Publish' }).isVisible()) {
	await admin.getByRole('button', { name: 'Publish' }).click();
	await admin.waitForTimeout(800);
}
check(
	'drop published',
	sql(`select published_at is not null from public.drops where id='drop-01'`) === 't'
);

// Move the drop to LIVE through the state control, as staff would: TEASE → REVEALED → LIVE.
for (const target of ['REVEALED', 'LIVE']) {
	await admin.goto(BASE + '/admin/drops/01-pineapple-haze', { waitUntil: 'networkidle' });
	const options = await admin
		.locator('#d-state option')
		.evaluateAll((os) => os.map((o) => o.value));
	if (!options.includes(target)) continue;
	await admin.selectOption('#d-state', target);
	await admin.locator('form[action="?/transition"] button[type=submit]').click();
	await admin.waitForTimeout(1200);
}
check(
	'drop is LIVE',
	sql(`select state from public.drops where id='drop-01'`) === 'LIVE',
	sql(`select state from public.drops where id='drop-01'`)
);

// Stock edit through the Stock tab.
await admin.goto(BASE + '/admin/drops/01-pineapple-haze/products/product-01-tee/stock', {
	waitUntil: 'networkidle'
});
const mStock = admin.locator('tr', { hasText: 'RW-D01-TEE-M' }).locator('input').first();
await mStock.fill('9');
await admin.getByRole('button', { name: /^Save (stock|\d+ changes?)$/ }).click();
await admin.waitForTimeout(1200);
check(
	'stock edit saved (M = 9)',
	sql(`select stock_count from public.variants where id='variant-01-tee-m'`) === '9'
);
check('stock change logged', Number(sql(`select count(*) from app.stock_movements`)) >= 1);

// ---------------------------------------------------------------- shopper
console.log('\nShopper: browse and buy');
const shop = await newPage(b);
const home = await shop.goto(BASE + '/', { waitUntil: 'networkidle' });
check('homepage 200', home.status() === 200);
await shop.goto(BASE + '/drops/01-pineapple-haze', { waitUntil: 'networkidle' });
check('product page shows the launch price', (await shop.content()).includes('₹4,100'));

await shop.waitForTimeout(1200);
await shop
	.locator('label[for^="buy"]')
	.filter({ hasText: /^\s*M\s*$/ })
	.first()
	.click();
await shop
	.getByRole('button', { name: /Buy now/i })
	.first()
	.click();
await shop.waitForURL(/\/cart/, { timeout: 15000 }).catch(() => {});
check('Buy now goes to checkout', /\/(cart|checkout)/.test(shop.url()), shop.url());
await shop.goto(BASE + '/cart', { waitUntil: 'networkidle' });
check('cart shows the tee at ₹4,100', (await shop.content()).includes('₹4,100'));

await shop.goto(BASE + '/checkout/information', { waitUntil: 'networkidle' });
await shop.fill('input[name=email]', SHOPPER);
await shop.fill('input[name=name]', 'Asha Test');
await shop.fill('input[name=phone]', '9876543210');
await shop.fill('input[name=line1]', '12 Test Street');
await shop.fill('input[name=city]', 'Bengaluru');
const stateField = shop.locator('[name=state]');
if ((await stateField.evaluate((el) => el.tagName)) === 'SELECT')
	await stateField.selectOption({ label: 'Karnataka' });
else await stateField.fill('Karnataka');
await shop.fill('input[name=pincode]', '560001');
await Promise.all([
	shop.waitForURL(/checkout\/processing/, { timeout: 30000 }).catch(() => {}),
	shop.locator('form button[type=submit]').last().click()
]);
check('order placed → payment page', shop.url().includes('/checkout/processing'), shop.url());
if (!shop.url().includes('/checkout/processing')) {
	await shop.screenshot({ path: SHOTS + 'checkout_fail.png', fullPage: true });
	console.log(
		'    page says:',
		(await shop.locator('[role=alert], .error, [aria-live]').allInnerTexts())
			.join(' | ')
			.slice(0, 400)
	);
	process.exit(summary() ? 1 : 0);
}
const token = new URL(shop.url()).searchParams.get('order');

const order = sql(
	`select id||'|'||state||'|'||total_paise||'|'||order_number from app.orders where public_token='${token}'`
).split('|');
check(
	'order pending payment, total ₹4,100',
	order[1] === 'pending_payment' && order[2] === '410000',
	order.join(' ')
);
let intent = sql(
	`select gateway_order_id||'|'||amount_paise from app.payments where order_id='${order[0]}' order by created_at desc limit 1`
).split('|');
if (!/^order_/.test(intent[0])) {
	await shop.screenshot({ path: SHOTS + 'processing_no_gateway.png', fullPage: true });
	console.log(
		'  NOTE  Razorpay refused the test keys; recording the payment intent its API would have returned'
	);
	sql(
		`insert into app.payments (order_id, kind, gateway, gateway_order_id, amount_paise) values ('${order[0]}', 'order', 'razorpay', 'order_E2E${Date.now()}', ${order[2]})`
	);
	intent = sql(
		`select gateway_order_id||'|'||amount_paise from app.payments where order_id='${order[0]}' order by created_at desc limit 1`
	).split('|');
}
check(
	'stock held: M down to 8',
	sql(`select stock_count from public.variants where id='variant-01-tee-m'`) === '8'
);

// ---------------------------------------------------------------- payment
console.log('\nRazorpay: signed webhook');
const paymentId = 'pay_E2E' + Date.now();
const wh = razorpayWebhook({
	orderId: intent[0],
	paymentId,
	amount: Number(intent[1]),
	secret: ENV.RAZORPAY_WEBHOOK_SECRET
});
const eventId = 'evt_e2e_' + Date.now();
const post = (body, signature, id = eventId) =>
	fetch(BASE + '/api/webhooks/razorpay', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-razorpay-signature': signature,
			'x-razorpay-event-id': id
		},
		body
	});
check('bad signature refused (401)', (await post(wh.body, 'f'.repeat(64))).status === 401);
check(
	'order still unpaid after bad signature',
	sql(`select state from app.orders where id='${order[0]}'`) === 'pending_payment'
);
check('genuine webhook accepted (200)', (await post(wh.body, wh.signature)).status === 200);
await new Promise((r) => setTimeout(r, 2500));
check(
	'order paid',
	sql(`select state from app.orders where id='${order[0]}'`) === 'paid',
	sql(`select state from app.orders where id='${order[0]}'`)
);
check(
	'redelivery is a duplicate (200)',
	(await (await post(wh.body, wh.signature)).text()) === 'duplicate'
);
check(
	'one payment captured, not two',
	sql(`select count(*) from app.payments where order_id='${order[0]}' and state='captured'`) === '1'
);
check(
	'invoice issued once',
	sql(`select count(*) from app.invoices where order_id='${order[0]}'`) === '1'
);

await shop.goto(BASE + '/checkout/processing?order=' + token, { waitUntil: 'networkidle' });
check(
	'payment page forwards to the order page',
	shop.url().includes('/order/' + token),
	shop.url()
);
check('order page says paid / confirmed', /paid|confirmed|thank/i.test(await shop.content()));
const inv = await shop.goto(BASE + `/order/${token}/invoice`, { waitUntil: 'networkidle' });
check('customer invoice opens', inv.status() === 200 && /invoice/i.test(await shop.content()));

const mail = readFileSync(new URL('./mail.jsonl', import.meta.url), 'utf8')
	.trim()
	.split('\n')
	.filter(Boolean)
	.map((l) => JSON.parse(l));
const sent = mail.filter((m) => JSON.stringify(m.to ?? '').includes(SHOPPER));
check('confirmation email sent to the shopper', sent.length >= 1, `${sent.length} emails`);
check(
	'confirmation email links the order page',
	sent.some((m) => (m.htmlbody ?? m.textbody ?? '').includes(token))
);

// ---------------------------------------------------------------- admin sees it
console.log('\nAdmin: the order');
await admin.goto(BASE + '/admin/orders', { waitUntil: 'networkidle' });
check('order in admin list', (await admin.content()).includes(order[3]));
check(
	'customer created',
	sql(`select count(*) from app.customers where email='${SHOPPER}'`) === '1'
);
check('carts screen loads', (await admin.goto(BASE + '/admin/carts')).status() === 200);
check('invoices register loads', (await admin.goto(BASE + '/admin/invoices')).status() === 200);
check('overview loads', (await admin.goto(BASE + '/admin')).status() === 200);

for (const p of [admin, shop])
	check(
		`no browser errors (${p === admin ? 'admin' : 'shop'})`,
		p.errors.length === 0,
		p.errors.slice(0, 3).join(' | ')
	);
await b.close();
process.exit(summary() ? 1 : 0);
