# Rootwear admin — going live

Everything the `cms` branch needs before it runs on the real site, in order.
The site is hosted on Cloudflare Workers and the database is Supabase.

## 1. Apply the database migrations

Every file in `supabase/migrations` (0001 to 0033), in order, on a new
Supabase project. The live project is `atoooqpjkesmnggyrmup` (Singapore),
already migrated to 0031; 0032 and 0033 are in this release.

1. Supabase → your project → **Connect** → **Session pooler**. Copy that
   connection string and put the database password in it. Don't use the
   direct one: it is IPv6 only and fails from most networks.
2. Run, with the PostgreSQL client (`psql`) installed:

   ```sh
   DATABASE_URL='postgresql://…' npm run db:migrate -- --dry-run   # lists what will run
   DATABASE_URL='postgresql://…' npm run db:migrate
   ```

   Each file runs in its own transaction and is recorded in Supabase's
   migration history, so running it again only applies new files.

3. Supabase → Project Settings → **Data API** → **Exposed schemas**: add
   `app` and save. The server reads orders, customers and everything else
   private through it with the secret key. Only the secret key can use it:
   `0030` gives the browser roles nothing in `app`.

The CMS migrations, for reference:

| File                                | What it adds                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `0022_staff_permissions.sql`        | Per-person permissions, owner guard, settings table                                                 |
| `0023_messaging.sql`                | Message templates and the send queue (outbox)                                                       |
| `0024_catalogue_cms.sql`            | Editable sizes, colourways, draft products, stock history, tax fields, the `catalogue` image bucket |
| `0025_orders_cms.sql`               | Order notes, invoices and credit notes, returns                                                     |
| `0026_cart_recovery.sql`            | Abandoned-checkout reminders                                                                        |
| `0027_leads.sql`                    | Leads and their history; turns every past form into a lead                                          |
| `0028_growth.sql`                   | Customer tags and consent, broadcasts, influencer seeding, digest                                   |
| `0029_money_guards.sql`             | Refund cap and gap-free invoice numbers                                                             |
| `0030_service_role_app.sql`         | Server access to `app` through the API; browser roles kept out                                      |
| `0031_price_visible.sql`            | A product price can be hidden; hidden pieces can't be bought                                        |
| `0032_commit_order_search_path.sql` | Fixes checkout on Supabase: order tokens use pgcrypto from `extensions`                             |
| `0033_close_public_api.sql`         | The public API key reads and writes nothing; the server alone reads the shop                        |

The database tests run every migration on a throwaway local Postgres:

```sh
PGBIN=/usr/sbin ./supabase/tests/run.sh
```

## 2. Environment variables

The site runs on Cloudflare Workers. Add each secret with
`npx wrangler secret put NAME` (it asks for the value), or in the dashboard:
Workers & Pages → rootwear → Settings → Variables and Secrets. Locally they
go in `.env`. `.env.example` lists them all with notes.

**Required for the admin to work at all**

| Variable                          | Where it comes from                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API (`https://….supabase.co`)                              |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (`sb_publishable_…`)                                         |
| `SUPABASE_SECRET_KEY`             | Same page, under Secret keys (`sb_secret_…`). Server only; never in a `PUBLIC_` variable |
| `PUBLIC_SITE_URL`                 | Already set in `wrangler.jsonc` to `https://rootwearclothing.com`                        |
| `CRON_SECRET`                     | Any long random string                                                                   |

> Until both Supabase keys are set the site runs on built-in sample data and
> admin is only the form inbox. Also fixed on this branch: the app previously
> could never see `PUBLIC_SUPABASE_URL`, so it would have stayed on sample
> data even with the keys set.

**Email**: ZeptoMail. The SMTP fallback needs a Node server, and Cloudflare
Workers can't open mail connections, so on Cloudflare email needs ZeptoMail.

| Variable                                           | Notes                                                      |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `ZEPTOMAIL_TOKEN`                                  | ZeptoMail → Mail Agents → SMTP/API → Send Mail token       |
| `ZEPTOMAIL_API_URL`                                | `https://api.zeptomail.in/v1.1/email` for an India account |
| `EMAIL_FROM`, `EMAIL_FROM_NAME`                    | A sender verified in ZeptoMail, e.g. `hi@rootwear.in`      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Only when running on a Node server, not on Cloudflare      |

For ZeptoMail, add the domain verification and the SPF/DKIM records it shows
to the `rootwearclothing.com` DNS, and wait for them to verify.

**WhatsApp and Meta**

| Variable                   | Notes                                                  |
| -------------------------- | ------------------------------------------------------ |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta app → WhatsApp → API Setup                        |
| `WHATSAPP_ACCESS_TOKEN`    | A permanent System User token (see below)              |
| `META_APP_SECRET`          | Meta app → Settings → Basic → App secret               |
| `META_VERIFY_TOKEN`        | Any long random string                                 |
| `META_PAGE_ACCESS_TOKEN`   | Only for lead ads: a Page token with `leads_retrieval` |

Settings → Email & WhatsApp in admin shows what is connected and can send a
test of each.

**Payments: Razorpay**

A deployed site always uses Razorpay, and refuses to place orders until the
three Razorpay values below are set. Use test-mode keys first (no real money
moves), then swap in live keys once the account is approved (KYC cleared).
The built-in mock gateway only runs on a developer's machine (`npm run dev`).

| Variable                  | Notes                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`        | `razorpay`                                                              |
| `RAZORPAY_KEY_ID`         | Razorpay Dashboard → Account & Settings → API Keys (`rzp_test_…`)       |
| `RAZORPAY_KEY_SECRET`     | Shown once when the key is generated. Server only                       |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you type when creating the webhook below. Not the key secret |

Create the webhook in Razorpay → Account & Settings → Webhooks:

- URL: `https://rootwearclothing.com/api/webhooks/razorpay`
- Secret: a long random string, also saved as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured` and `order.paid`

The webhook, not the browser redirect, is what marks an order paid. If test
payments succeed but orders stay unpaid, the webhook secret is the first thing
to check.

## 3. Deploy to Cloudflare

```sh
npx wrangler login
npm run deploy          # builds and deploys the site as the "rootwear" Worker
```

The custom domains `rootwearclothing.com` and `www.rootwearclothing.com` are
declared in `wrangler.jsonc`, so a deploy attaches them. The domain's DNS has
to be on the same Cloudflare account.

## 4. Scheduled jobs

A second small Worker, `rootwear-cron` (`workers/cron`), calls these on a
schedule. Each takes `Authorization: Bearer <CRON_SECRET>`.

| Endpoint                  | How often                  | What it does                             |
| ------------------------- | -------------------------- | ---------------------------------------- |
| `/api/cron/expire-orders` | every 15 min, always first | Fails unpaid orders, frees their stock   |
| `/api/cron/outbox`        | every 15 min               | Retries messages a provider was down for |
| `/api/cron/carts`         | hourly                     | Automatic cart reminders, if switched on |
| `/api/cron/digest`        | off                        | The morning email; not scheduled         |

An abandoned order can hold its stock for up to about 25 minutes: the
10-minute payment window plus up to 15 minutes until the next sweep.

```sh
npx wrangler secret put CRON_SECRET -c workers/cron/wrangler.jsonc   # same value as the site's
npm run deploy:cron
```

Its logs (Workers & Pages → rootwear-cron → Logs) show any job that failed.

## 5. Meta setup (WhatsApp and lead ads)

Meta reviews parts of this, so start early.

1. Create a Business portfolio at business.facebook.com and verify the
   business (Business Settings → Security Centre). This can take a few days.
2. At developers.facebook.com create an app of type **Business**, and add
   **WhatsApp**. Add a phone number that is **not** on the WhatsApp app (a new
   SIM or a landline that can take a verification call).
3. Business Settings → System Users: create one, give it the app and the
   WhatsApp account, and generate a **permanent** token with
   `whatsapp_business_messaging` (and `whatsapp_business_management`). That is
   `WHATSAPP_ACCESS_TOKEN`.
4. Webhooks: in the app, set the callback URL to
   `https://rootwearclothing.com/api/webhooks/meta` with your `META_VERIFY_TOKEN`, then
   subscribe WhatsApp to **messages**. For lead ads, also subscribe the
   Facebook Page to **leadgen**.
5. Submit these message templates in WhatsApp Manager. The name, language
   (`en`) and the order of `{{1}}, {{2}}…` must match admin → Messages →
   Templates:

| Template name      | Category  | Variables in order                                |
| ------------------ | --------- | ------------------------------------------------- |
| `order_confirmed`  | Utility   | name, order number, total, order link             |
| `order_dispatched` | Utility   | name, order number, courier, tracking, order link |
| `balance_due`      | Utility   | name, drop name, balance, due date, pay link      |
| `cart_reminder`    | Marketing | name, items, cart link                            |
| `drop_live`        | Marketing | name, drop name, drop link                        |
| `broadcast`        | Marketing | name, message                                     |

Marketing templates need the customer's opt-in. Checkout now has two
unticked boxes (email, WhatsApp); a tick is saved on the customer with a
dated note, and broadcasts only reach people who ticked, signed up through
a drop form, or were marked as agreeing by staff.

## 6. First sign-in

1. Create the owner: `ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_ROLE=owner node scripts/create-admin.mjs`
   (Trone's existing `layout` account becomes a person with the "Edit site
   layout" permission automatically.)
2. Sign in at `/admin`, then Settings → Business & GST: check the address and
   state. Turn on GST and enter the GSTIN when it arrives; invoices issued
   before then stay as they were.
3. Settings → Staff → Add person for anyone else. The presets (Packing,
   Support, Accountant, Layout) are starting points; tick and untick freely.
4. Settings → Alerts & digest: choose who gets the morning email.

## 7. Check before launch

- **Drop 01 is published.** The homepage now shows the newest _published_
  live drop, so a drop being prepared can never take it over. If Drop 01
  were unpublished it would still show, as long as no other live drop is
  published. Publish it from Drops to be sure.
- Every product has a **hero cut-out** photo (transparent PNG) if its page
  should float the garment over the name, as Drop 01 does.
- Policy pages: they are served from the code until someone edits one in
  Layout → Pages.
- **Supabase → Authentication → Sign In / Providers → Email: "Confirm email"
  is on.** The site only links a guest's past orders to an account whose
  email has been confirmed; with confirmation off, anyone could sign up as a
  customer's address.
- **Razorpay keys work.** A deployed site refuses to take orders without all
  three Razorpay values, so a missing or rejected key stops sales rather than
  letting anything through. Check them with one test-mode payment.
- **Rate limits.** `wrangler.jsonc` limits each visitor to 10 sign-in,
  checkout and contact posts a minute, and 30 cart and sign-up posts.
  Cloudflare applies them on deploy; nothing to set up.

## 8. Testing before a deploy

The end-to-end suite (`tests/e2e`) runs the whole shop against a **local**
Supabase: admin opens a drop, a shopper buys, Razorpay's webhook pays (signed
the way Razorpay signs it), then fulfilment, refunds, coupons, leads, crons,
every admin screen, and attacks on all of it (API access with the public key,
staff without permission, forged and short payments, lookalike accounts,
tampered quantities, bad uploads). It wipes the local database each run and
refuses to run against anything else.

One-time setup:

1. A container runtime (Docker, or Podman with
   `DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`), then
   `npx supabase start`. It applies every migration; `npx supabase status`
   prints the local keys.
2. Create `.env.e2e` (git-ignored) with the local URL and keys, Razorpay
   **test** keys, `ZEPTOMAIL_TOKEN=test`,
   `ZEPTOMAIL_API_URL=http://127.0.0.1:54399/v1.1/email`, a `CRON_SECRET`,
   and an `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the test owner.
3. `playwright-core` installed anywhere; set `PLAYWRIGHT_CORE` to its path if
   it isn't next to the repo.

Each run:

```sh
node tests/e2e/fakezepto.mjs &               # records emails instead of sending
npx vite dev --mode e2e --port 5199 &        # the site, on .env.e2e
tests/e2e/run.sh                             # resets the local DB, runs all suites
```

To test the production build (stricter: cross-site form checks, rate limits,
no mock gateway), `npm run build`, then
`npx wrangler dev --local --port 8799 --env-file .env.e2e --infer-origin-from-routes=false`
and run with `BASE=http://127.0.0.1:8799`. Pass `--env-file`: without it
wrangler reads `.env`, which holds the live keys.

The database's own checks still run on their own throwaway Postgres:
`PGBIN=/usr/sbin ./supabase/tests/run.sh`.
