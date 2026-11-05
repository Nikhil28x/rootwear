// Attacks on the running site, after purchase.mjs has opened Drop 01 for
// sale and placed one paid order. Every check is what SHOULD happen.
import { createRequire } from 'node:module';
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

const require = createRequire(new URL('../../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const API = ENV.PUBLIC_SUPABASE_URL;
const PUB = ENV.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = createClient(API, ENV.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const rest = (path, { token, method = 'GET', body, profile } = {}) =>
	fetch(`${API}/rest/v1/${path}`, {
		method,
		headers: {
			apikey: PUB,
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(profile ? { 'accept-profile': profile, 'content-profile': profile } : {}),
			'content-type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});

const b = await browser();

// ------------------------------------------------------------ the public API
console.log('\nSupabase API with the publishable key (anyone can get it)');
sql(`update public.products set price_visible=false where id='product-01-tee'`);
let r = await rest('products?select=name,launch_price_paise');
check(
	'anon cannot read products (hidden price)',
	r.status === 401 || r.status === 403,
	`${r.status} ${(await r.text()).slice(0, 80)}`
);
r = await rest('price_history?select=price_paise');
check('anon cannot read price history', r.status === 401 || r.status === 403, String(r.status));
r = await rest('policies?slug=eq.terms', { method: 'PATCH', body: { body: 'defaced' } });
check('anon cannot edit policy pages', r.status === 401 || r.status === 403, String(r.status));
r = await rest('orders?select=id', { profile: 'app' });
check('anon cannot read orders', r.status === 401 || r.status === 403, String(r.status));
sql(`update public.products set price_visible=true where id='product-01-tee'`);

// A real signed-in customer account, made through the public sign-up.
const anonAuth = createClient(API, PUB, { auth: { persistSession: false } });
const custEmail = `cust${Date.now()}@example.com`;
const custPass = 'Customer-pass-123';
await anonAuth.auth.signUp({ email: custEmail, password: custPass });
const { data: s1 } = await anonAuth.auth.signInWithPassword({
	email: custEmail,
	password: custPass
});
const jwt = s1.session?.access_token;
check('customer can sign up and sign in', Boolean(jwt));
r = await rest('products?select=launch_price_paise', { token: jwt });
check(
	'signed-in customer cannot read products via API',
	r.status === 401 || r.status === 403,
	String(r.status)
);
r = await rest('policies?slug=eq.terms', {
	token: jwt,
	method: 'PATCH',
	body: { body: 'defaced' }
});
check(
	'signed-in customer cannot edit policies',
	r.status === 401 || r.status === 403,
	String(r.status)
);
r = await rest('rpc/commit_order', { token: jwt, method: 'POST', body: {}, profile: 'app' });
check(
	'signed-in customer cannot call commit_order',
	[401, 403, 404].includes(r.status) &&
		!/committed|status/.test(
			await r
				.clone()
				.text()
				.then((t) => (/PGRST202|permission/.test(t) ? '' : t))
		),
	String(r.status)
);

// ------------------------------------------------------------ account takeover
console.log('\nAccounts');
sql(`insert into app.customers (email) values ('priya.sharma@example.com') on conflict do nothing`);
const look = 'priya_sharma@example.com';
await anonAuth.auth.signUp({ email: look, password: custPass });
const lookPage = await newPage(b);
await lookPage.goto(BASE + '/account/login');
await lookPage.fill('input[name=email]', look);
await lookPage.fill('input[name=password]', custPass);
await Promise.all([
	lookPage.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }).catch(() => {}),
	lookPage.click('form button[type=submit]')
]);
await lookPage.goto(BASE + '/account', { waitUntil: 'networkidle' });
check(
	"lookalike email does NOT claim priya.sharma's record",
	sql(`select user_id is null from app.customers where email='priya.sharma@example.com'`) === 't'
);

const redirect = await lookPage.request.get(
	BASE + '/account/login?redirectTo=%2F%09%2Fevil.example',
	{ maxRedirects: 0 }
);
const loc = redirect.headers()['location'] ?? '';
check(
	'tab-trick redirect stays on this site',
	!/evil\.example/.test(loc) || (loc.startsWith('/') && !loc.startsWith('//')),
	loc
);

const custAdmin = await lookPage.goto(BASE + '/admin', { waitUntil: 'networkidle' });
check('customer opening /admin gets 403', custAdmin.status() === 403, String(custAdmin.status()));

// ------------------------------------------------------------ staff limits
console.log('\nStaff permissions');
async function makeStaff(email, permissions) {
	const { data } = await service.auth.admin.createUser({
		email,
		password: 'Staff-pass-12345',
		email_confirm: true
	});
	sql(
		`insert into app.staff (user_id, email, role, is_owner, permissions, active) values ('${data.user.id}', '${email}', 'staff', false, array[${permissions.map((p) => `'${p}'`).join(',')}]::text[], true)`
	);
	return email;
}
const packer = await makeStaff(`packer${Date.now()}@rootwear.test`, ['orders.view']);
const pp = await newPage(b);
check('orders-only staff signs in', await adminLogin(pp, packer, 'Staff-pass-12345'));
check('…can open orders', (await pp.goto(BASE + '/admin/orders')).status() === 200);
check(
	'…cannot open staff settings',
	(await pp.goto(BASE + '/admin/settings/staff')).status() === 403
);
check('…cannot open the drop editor', (await pp.goto(BASE + '/admin/drops')).status() === 403);
const ppCookie = cookieHeader(await pp.context().cookies());
const orderId = sql(`select id from app.orders where state='paid' limit 1`);
const refundsBefore = sql(`select count(*) from app.refunds`);
let a = await action(
	`/admin/orders/${orderId}`,
	'refund',
	{ amount: '100', reason: 'x' },
	{ cookie: ppCookie }
);
check(
	'…cannot refund (needs orders.refund)',
	a.status === 403 || a.json?.type === 'failure' || a.json?.type === 'error',
	`${a.status} ${a.text.slice(0, 80)}`
);
check('…and no refund was recorded', sql(`select count(*) from app.refunds`) === refundsBefore);
a = await action('/admin/drops/01-pineapple-haze', 'publish', {}, { cookie: ppCookie });
check(
	'…cannot publish/unpublish drops',
	a.status === 403 || a.json?.type !== 'success',
	`${a.status}`
);

const manager = await makeStaff(`manager${Date.now()}@rootwear.test`, [
	'staff.manage',
	'orders.view'
]);
const mp = await newPage(b);
await adminLogin(mp, manager, 'Staff-pass-12345');
a = await action(
	'/admin/settings/staff',
	'invite',
	{ email: custEmail, name: 'x', permissions: 'orders.view' },
	{ cookie: cookieHeader(await mp.context().cookies()) }
);
check(
	'non-owner cannot pull a customer account onto staff',
	a.json?.type === 'failure',
	a.text.slice(0, 160)
);
check(
	'…customer is not staff',
	sql(`select count(*) from app.staff where email='${custEmail}'`) === '0'
);

// ------------------------------------------------------------ buying rules
console.log('\nBuying rules');
const shop = await newPage(b);
await shop.goto(BASE + '/drops/01-pineapple-haze', { waitUntil: 'networkidle' });
const shopCookie = () => shop.context().cookies().then(cookieHeader);
for (const [label, qty] of [
	['negative', '-1'],
	['huge', '9999'],
	['text', 'abc'],
	['fraction', '1.5']
]) {
	a = await action(
		'/cart',
		'add',
		{ variantId: 'variant-01-tee-s', quantity: qty },
		{ cookie: await shopCookie() }
	);
	check(`add-to-cart refuses ${label} quantity`, a.json?.type === 'failure', a.text.slice(0, 100));
}
a = await action(
	'/cart',
	'add',
	{ variantId: 'variant-does-not-exist', quantity: '1' },
	{ cookie: await shopCookie() }
);
check('add-to-cart refuses unknown variant', a.json?.type === 'failure');

sql(`update public.products set price_visible=false where id='product-01-tee'`);
a = await action(
	'/cart',
	'add',
	{ variantId: 'variant-01-tee-s', quantity: '1' },
	{ cookie: await shopCookie() }
);
check('add-to-cart refuses a hidden-price piece', a.json?.type === 'failure', a.text.slice(0, 100));
sql(`update public.products set price_visible=true where id='product-01-tee'`);

// Cart it while on sale, then close the drop: checkout must refuse.
a = await action(
	'/cart',
	'add',
	{ variantId: 'variant-01-tee-s', quantity: '1' },
	{ cookie: await shopCookie() }
);
const setCookie = a.status;
const jar = await shopCookie();
const cartCookie = (
	await fetch(`${BASE}/cart?/add`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: BASE,
			'x-sveltekit-action': 'true'
		},
		body: 'variantId=variant-01-tee-s&quantity=1',
		redirect: 'manual'
	})
).headers
	.getSetCookie()
	.map((c) => c.split(';')[0])
	.join('; ');
check(
	'a fresh cart can still be filled while LIVE',
	/rw_cart=/.test(cartCookie),
	String(setCookie)
);
sql(`update public.drops set state='SOLD_OUT' where id='drop-01'`);
a = await action(
	'/checkout/information',
	null,
	{
		email: 'late@example.com',
		name: 'Late Buyer',
		phone: '9876543210',
		line1: '1 Road',
		city: 'Pune',
		state: 'Maharashtra',
		pincode: '411001',
		country: 'IN'
	},
	{ cookie: cartCookie }
);
check(
	'checkout refuses a line whose drop closed after carting',
	a.json?.type === 'failure' && /isn.t on sale/.test(a.text),
	a.text.slice(0, 160)
);
check(
	'…and no order was placed',
	sql(
		`select count(*) from app.orders o join app.customers c on c.id=o.customer_id where c.email='late@example.com'`
	) === '0'
);
sql(`update public.drops set state='LIVE' where id='drop-01'`);

sql(`update public.products set status='archived' where id='product-01-tee'`);
const arch = await shop.goto(BASE + '/drops/01-pineapple-haze', { waitUntil: 'networkidle' });
check(
	'archived product is off the site',
	arch.status() === 404 || !(await shop.content()).includes('₹4,100'),
	String(arch.status())
);
sql(`update public.products set status='active' where id='product-01-tee'`);

// ------------------------------------------------------------ webhook amounts
console.log('\nPayments');
// A fresh order to pay short.
const fresh = (
	await fetch(`${BASE}/cart?/add`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: BASE,
			'x-sveltekit-action': 'true'
		},
		body: 'variantId=variant-01-tee-l&quantity=1',
		redirect: 'manual'
	})
).headers
	.getSetCookie()
	.map((c) => c.split(';')[0])
	.join('; ');
const placed = await action(
	'/checkout/information',
	null,
	{
		email: 'short@example.com',
		name: 'Short Payer',
		phone: '9876543210',
		line1: '1 Road',
		city: 'Pune',
		state: 'Maharashtra',
		pincode: '411001',
		country: 'IN'
	},
	{ cookie: fresh }
);
const shortToken = /order=([0-9a-f]+)/.exec(placed.text)?.[1];
check('order placed for the short-payment test', Boolean(shortToken), placed.text.slice(0, 120));
if (shortToken) {
	const oid = sql(`select id from app.orders where public_token='${shortToken}'`);
	if (!sql(`select count(*) from app.payments where order_id='${oid}'`).startsWith('1'))
		sql(
			`insert into app.payments (order_id, kind, gateway, gateway_order_id, amount_paise) select id, 'order', 'razorpay', 'order_SHORT${Date.now()}', total_paise from app.orders where id='${oid}'`
		);
}
const pending = sql(
	`select p.gateway_order_id||'|'||p.amount_paise||'|'||o.id from app.payments p join app.orders o on o.id=p.order_id where o.state='pending_payment' and p.gateway_order_id is not null limit 1`
);
if (pending) {
	const [gid, amt, oid] = pending.split('|');
	const wh = razorpayWebhook({
		orderId: gid,
		paymentId: 'pay_short' + Date.now(),
		amount: Number(amt) - 100,
		secret: ENV.RAZORPAY_WEBHOOK_SECRET
	});
	await fetch(BASE + '/api/webhooks/razorpay', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-razorpay-signature': wh.signature,
			'x-razorpay-event-id': 'evt_short' + Date.now()
		},
		body: wh.body
	});
	await new Promise((res) => setTimeout(res, 1500));
	check(
		'a short payment does not mark the order paid',
		sql(`select state from app.orders where id='${oid}'`) === 'pending_payment'
	);
	const full = razorpayWebhook({
		orderId: gid,
		paymentId: 'pay_full' + Date.now(),
		amount: Number(amt),
		secret: ENV.RAZORPAY_WEBHOOK_SECRET
	});
	await fetch(BASE + '/api/webhooks/razorpay', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-razorpay-signature': full.signature,
			'x-razorpay-event-id': 'evt_full' + Date.now()
		},
		body: full.body
	});
	await new Promise((res) => setTimeout(res, 1500));
	check('…the full amount does', sql(`select state from app.orders where id='${oid}'`) === 'paid');
} else console.log('  SKIP  no pending order with a gateway order to underpay');
const noId = razorpayWebhook({
	orderId: 'order_x',
	paymentId: 'pay_x',
	amount: 1,
	secret: ENV.RAZORPAY_WEBHOOK_SECRET
});
r = await fetch(BASE + '/api/webhooks/razorpay', {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'x-razorpay-signature': noId.signature },
	body: noId.body
});
check('signed webhook without an event id is refused (400)', r.status === 400, String(r.status));
a = await action('/checkout/processing', 'settleMock', {
	order: sql(`select public_token from app.orders limit 1`)
});
check('free "test payment" is refused', a.json?.type === 'failure', a.text.slice(0, 100));

// ------------------------------------------------------------ admin uploads
console.log('\nAdmin uploads');
const owner = await newPage(b);
await adminLogin(owner, ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
const photos = '/admin/drops/01-pineapple-haze/products/product-01-tee/photos';
const before = sql(`select count(*) from public.product_images where product_id='product-01-tee'`);
const up = await owner.request.post(`${BASE}${photos}?/upload`, {
	headers: { origin: BASE, 'x-sveltekit-action': 'true' },
	multipart: {
		files: {
			name: 'evil.png',
			mimeType: 'image/png',
			buffer: Buffer.from('<svg onload=alert(1)>not an image</svg>')
		},
		alt: 'test',
		role: 'detail'
	}
});
check(
	'a non-image labelled image/png is refused',
	sql(`select count(*) from public.product_images where product_id='product-01-tee'`) === before,
	(await up.text()).slice(0, 120)
);
const rs = await owner.request.post(`${BASE}${photos}?/restore`, {
	headers: { origin: BASE, 'x-sveltekit-action': 'true' },
	form: {
		image: JSON.stringify({
			url: 'https://evil.example/track.png',
			alt: 'x',
			role: 'detail',
			position: 99,
			caption: null,
			width: 1,
			height: 1,
			colourwayId: null
		})
	}
});
check(
	'restoring a photo from an outside address is refused',
	sql(`select count(*) from public.product_images where url like 'https://evil.example%'`) === '0',
	(await rs.text()).slice(0, 120)
);

for (const p of [lookPage, pp, mp, shop, owner])
	if (p.errors.length) console.log('  page errors:', p.errors.slice(0, 2));
await b.close();
process.exit(summary() ? 1 : 0);
