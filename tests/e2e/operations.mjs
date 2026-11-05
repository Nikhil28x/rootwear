// The back office, after purchase.mjs: fulfil the paid order, try a refund,
// a coupon end to end, a lead from the contact form, crons, exports.
import { readFileSync } from 'node:fs';
import {
	BASE,
	ENV,
	action,
	adminLogin,
	browser,
	check,
	cookieHeader,
	newPage,
	razorpayWebhook,
	sql,
	summary
} from './lib.mjs';

const b = await browser();
const admin = await newPage(b);
await adminLogin(admin, ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
const cookie = cookieHeader(await admin.context().cookies());
const mails = () =>
	readFileSync(new URL('./mail.jsonl', import.meta.url), 'utf8')
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((l) => JSON.parse(l));

// ------------------------------------------------------------ fulfilment
console.log('\nFulfilment');
const [orderId, email] = sql(
	`select o.id||'|'||c.email from app.orders o join app.customers c on c.id=o.customer_id where o.state='paid' limit 1`
).split('|');
const base = `/admin/orders/${orderId}`;
let a = await action(base, 'pack', {}, { cookie });
check(
	'pack',
	a.json?.type === 'success' &&
		sql(`select state from app.orders where id='${orderId}'`) === 'packed',
	a.text.slice(0, 120)
);
const sentBefore = mails().length;
a = await action(
	base,
	'dispatch',
	{ courier: 'Delhivery', tracking: 'DLV123456', notify: 'on' },
	{ cookie }
);
check(
	'dispatch with tracking',
	sql(`select state||'|'||tracking_ref from app.orders where id='${orderId}'`) ===
		'dispatched|DLV123456',
	a.text.slice(0, 120)
);

await fetch(BASE + '/api/cron/outbox', {
	method: 'POST',
	headers: { authorization: `Bearer ${ENV.CRON_SECRET}` }
});
await new Promise((r) => setTimeout(r, 1000));
const dispatchMail = mails()
	.slice(sentBefore)
	.find((m) => JSON.stringify(m.to).includes(email));
check(
	'dispatch email sent with tracking',
	Boolean(dispatchMail) && JSON.stringify(dispatchMail).includes('DLV123456')
);
a = await action(base, 'deliver', {}, { cookie });
check(
	'deliver',
	sql(`select state from app.orders where id='${orderId}'`) === 'delivered',
	a.text.slice(0, 120)
);

for (const path of [
	base,
	`/admin/orders/print?kind=packing&ids=${orderId}`,
	`/admin/orders/print?kind=label&ids=${orderId}`,
	`/admin/orders/print?kind=invoice&ids=${orderId}`,
	'/admin/orders/packing-list',
	'/admin/orders/export',
	'/admin/invoices/export',
	'/admin/invoices/export?type=hsn',
	'/admin/invoices/export?type=states'
]) {
	const res = await admin.request.get(BASE + path);
	check(`opens ${path.replace(orderId, ':id')}`, res.status() === 200, String(res.status()));
}
const csv = await (await admin.request.get(BASE + '/admin/orders/export?view=all')).text();
check(
	'orders CSV has the order',
	csv.includes(sql(`select order_number from app.orders where id='${orderId}'`))
);

// ------------------------------------------------------------ refund
console.log('\nRefund (Razorpay refuses the test keys, so this must fail cleanly)');
a = await action(base, 'refund', { amount: '500', reason: 'goodwill', note: 'e2e' }, { cookie });
const refunds = sql(`select coalesce(string_agg(state::text, ','), '') from app.refunds`);
check(
	'refund failure is reported, not a crash',
	a.json?.type === 'failure' || a.json?.type === 'success',
	a.text.slice(0, 160)
);
check(
	'no refund is recorded as processed without the gateway',
	!/processed/.test(refunds),
	refunds
);
a = await action(base, 'refund', { amount: '999999', reason: 'goodwill' }, { cookie });
check('refund above the amount paid is refused', a.json?.type === 'failure', a.text.slice(0, 120));

// ------------------------------------------------------------ coupon
console.log('\nCoupon');
a = await action(
	'/admin/coupons',
	'create',
	{ code: 'E2E10', kind: 'percent', value: '10', maxUses: '1' },
	{ cookie }
);
check(
	'coupon created',
	sql(`select count(*) from app.coupons where code='E2E10'`) === '1',
	a.text.slice(0, 120)
);
const cart = (
	await fetch(`${BASE}/cart?/add`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: BASE,
			'x-sveltekit-action': 'true'
		},
		body: 'variantId=variant-01-tee-xl&quantity=1',
		redirect: 'manual'
	})
).headers
	.getSetCookie()
	.map((c) => c.split(';')[0])
	.join('; ');
a = await action('/cart', 'applyCoupon', { code: 'e2e10' }, { cookie: cart });
check('coupon applies (case-insensitive)', a.json?.type === 'success', a.text.slice(0, 120));
a = await action('/cart', 'applyCoupon', { code: 'NOPE' }, { cookie: cart });
check('unknown coupon refused', a.json?.type === 'failure');
const placed = await action(
	'/checkout/information',
	null,
	{
		email: 'coupon@example.com',
		name: 'Coupon User',
		phone: '9876543210',
		line1: '2 Road',
		city: 'Chennai',
		state: 'Tamil Nadu',
		pincode: '600001',
		country: 'IN'
	},
	{ cookie: cart }
);
const token = /order=([0-9a-f]+)/.exec(placed.text)?.[1];
check('order with coupon placed', Boolean(token), placed.text.slice(0, 120));
const totals = sql(
	`select subtotal_paise||'|'||discount_paise||'|'||total_paise from app.orders where public_token='${token}'`
);
check('10% off ₹4,100 = ₹410 discount, ₹3,690 total', totals === '410000|41000|369000', totals);
// Pay it, so the coupon's one use is spent.
sql(
	`insert into app.payments (order_id, kind, gateway, gateway_order_id, amount_paise) select id, 'order', 'razorpay', 'order_CPN${Date.now()}', total_paise from app.orders where public_token='${token}' and not exists (select 1 from app.payments p where p.order_id = app.orders.id)`
);
const [gid, amt] = sql(
	`select gateway_order_id||'|'||amount_paise from app.payments p join app.orders o on o.id=p.order_id where o.public_token='${token}'`
).split('|');
const wh = razorpayWebhook({
	orderId: gid,
	paymentId: 'pay_cpn' + Date.now(),
	amount: Number(amt),
	secret: ENV.RAZORPAY_WEBHOOK_SECRET
});
await fetch(BASE + '/api/webhooks/razorpay', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-razorpay-signature': wh.signature,
		'x-razorpay-event-id': 'evt_cpn' + Date.now()
	},
	body: wh.body
});
await new Promise((r) => setTimeout(r, 1500));
check(
	'coupon order paid',
	sql(`select state from app.orders where public_token='${token}'`) === 'paid'
);
const cart2 = (
	await fetch(`${BASE}/cart?/add`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: BASE,
			'x-sveltekit-action': 'true'
		},
		body: 'variantId=variant-01-tee-xl&quantity=1',
		redirect: 'manual'
	})
).headers
	.getSetCookie()
	.map((c) => c.split(';')[0])
	.join('; ');
a = await action('/cart', 'applyCoupon', { code: 'E2E10' }, { cookie: cart2 });
check('single-use coupon cannot be used twice', a.json?.type === 'failure', a.text.slice(0, 120));
const inv = sql(
	`select count(*) from app.invoices i join app.orders o on o.id=i.order_id where o.public_token='${token}'`
);
check('invoice issued for the coupon order', inv === '1');

// ------------------------------------------------------------ leads
console.log('\nLeads');
a = await action('/contact', null, {
	name: 'Rahul Lead',
	email: 'rahul.lead@example.com',
	subject: 'press',
	message: 'Do you do bulk orders for 50 tees?',
	website: ''
});
check(
	'contact form accepted',
	a.json?.type === 'success' || a.json?.type === 'redirect',
	a.text.slice(0, 120)
);
check(
	'…becomes a lead',
	sql(`select count(*) from app.leads where email='rahul.lead@example.com'`) === '1'
);
a = await action('/contact', null, {
	name: 'Bot',
	email: 'bot@example.com',
	subject: 'x',
	message: 'spam spam',
	website: 'http://spam'
});
check(
	'honeypot-filled contact form is not stored as a lead',
	sql(`select count(*) from app.leads where email='bot@example.com'`) === '0'
);
const xss = '<img src=x onerror=alert(1)>';
await action('/contact', null, {
	name: xss,
	email: 'xss@example.com',
	subject: 'other',
	message: 'hello there friend',
	website: ''
});
await admin.goto(BASE + '/admin/leads', { waitUntil: 'networkidle' });
const html = await admin.content();
check(
	'lead list escapes HTML in names',
	!html.includes(xss) && admin.errors.every((e) => !/alert/.test(e))
);
check('leads page loads', (await admin.request.get(BASE + '/admin/leads')).status() === 200);

// ------------------------------------------------------------ crons
console.log('\nCrons');
for (const c of ['outbox', 'carts', 'digest', 'expire-orders']) {
	const res = await fetch(`${BASE}/api/cron/${c}`, {
		method: 'POST',
		headers: { authorization: `Bearer ${ENV.CRON_SECRET}` }
	});
	check(`cron ${c} runs`, res.status === 200, `${res.status} ${(await res.text()).slice(0, 80)}`);
}
check(
	'no messages stuck failing in the outbox',
	sql(`select count(*) from app.message_outbox where status='failed'`) === '0',
	sql(
		`select coalesce(string_agg(distinct coalesce(last_error, ''), ' | '), '') from app.message_outbox where status='failed'`
	).slice(0, 200)
);

// ------------------------------------------------------------ every admin screen
console.log('\nEvery admin screen opens');
const screens = [
	'/admin',
	'/admin/reports',
	'/admin/drops',
	'/admin/orders',
	'/admin/carts',
	'/admin/invoices',
	'/admin/leads',
	'/admin/leads/sources',
	'/admin/customers',
	'/admin/contact',
	'/admin/submissions',
	'/admin/demand',
	'/admin/coupons',
	'/admin/broadcasts',
	'/admin/influencers',
	'/admin/layout',
	'/admin/messages',
	'/admin/messages/templates',
	'/admin/audit',
	'/admin/account',
	'/admin/settings/business',
	'/admin/settings/shipping',
	'/admin/settings/alerts',
	'/admin/settings/channels',
	'/admin/settings/staff',
	'/admin/reservations'
];
for (const s of screens) {
	const res = await admin.goto(BASE + s, { waitUntil: 'networkidle' }).catch(() => null);
	check(`  ${s}`, res && res.status() < 400, res ? String(res.status()) : 'no response');
}
check(
	'no browser errors in admin',
	admin.errors.length === 0,
	admin.errors.slice(0, 3).join(' | ')
);

await b.close();
process.exit(summary() ? 1 : 0);
