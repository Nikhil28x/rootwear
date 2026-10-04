-- Pre-order mode: a drop-level switch, set from admin.
--
-- On, the product page's buy bar offers "Pre-order" — a signup (name, email,
-- phone, size) into app.preorder_signups, no payment taken. Off, it offers
-- "Buy now", the normal cart and checkout. Defaults off, so existing drops
-- keep selling exactly as they do today.
alter table public.drops
	add column if not exists preorder_mode boolean not null default false;

comment on column public.drops.preorder_mode is
	'When true the storefront takes pre-order signups for this drop instead of selling it.';
