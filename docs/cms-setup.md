# Rootwear admin — going live

Everything the `cms` branch needs before it runs on the real site, in order.
Nothing here has been applied to the live Supabase project yet.

## 1. Apply the database migrations

Seven new migrations, applied in order after `0021`:

| File | What it adds |
|---|---|
| `0022_staff_permissions.sql` | Per-person permissions, owner guard, settings table |
| `0023_messaging.sql` | Message templates and the send queue (outbox) |
| `0024_catalogue_cms.sql` | Editable sizes, colourways, draft products, stock history, tax fields, the `catalogue` image bucket |
| `0025_orders_cms.sql` | Order notes, invoices and credit notes, returns |
| `0026_cart_recovery.sql` | Abandoned-checkout reminders |
| `0027_leads.sql` | Leads and their history; turns every past form into a lead |
| `0028_growth.sql` | Customer tags and consent, broadcasts, influencer seeding, digest |

Run them with the Supabase CLI (`supabase db push`) or paste each file into the
SQL editor in order. Take a backup first (Database → Backups).

`0024` changes the size column from a fixed list to text. Drop 01 keeps its
sizes, SKUs and stock exactly as they are.

The database tests run every migration on a throwaway local Postgres:

```sh
PGBIN=/usr/sbin ./supabase/tests/run.sh   # 67 checks
```

## 2. Environment variables

Add these to the server environment (Vercel → Settings → Environment
Variables, or `.env` locally). `.env.example` lists them all with notes.

**Required for the admin to work at all**

| Variable | Where it comes from |
|---|---|
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server only; never in a `PUBLIC_` variable |
| `PUBLIC_SITE_URL` | `https://rootwear.in` — used in links inside messages |
| `CRON_SECRET` | Any long random string |

> Until both Supabase keys are set the site runs on built-in sample data and
> admin is only the form inbox. Also fixed on this branch: the app previously
> could never see `PUBLIC_SUPABASE_URL`, so it would have stayed on sample
> data even with the keys set.

**Email** — ZeptoMail if its token is set, otherwise your mailbox over SMTP.

| Variable | Notes |
|---|---|
| `ZEPTOMAIL_TOKEN` | ZeptoMail → Mail Agents → SMTP/API → Send Mail token |
| `ZEPTOMAIL_API_URL` | `https://api.zeptomail.in/v1.1/email` for an India account |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | A sender verified in ZeptoMail, e.g. `hi@rootwear.in` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Only if not using ZeptoMail |

For ZeptoMail, add the domain verification and the SPF/DKIM records it shows
to the `rootwear.in` DNS, and wait for them to verify.

**WhatsApp and Meta**

| Variable | Notes |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta app → WhatsApp → API Setup |
| `WHATSAPP_ACCESS_TOKEN` | A permanent System User token (see below) |
| `META_APP_SECRET` | Meta app → Settings → Basic → App secret |
| `META_VERIFY_TOKEN` | Any long random string |
| `META_PAGE_ACCESS_TOKEN` | Only for lead ads: a Page token with `leads_retrieval` |

Settings → Email & WhatsApp in admin shows what is connected and can send a
test of each.

## 3. Scheduled jobs

All four take `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | How often | What it does |
|---|---|---|
| `/api/cron/expire-orders` | every 5 min | Already existed: frees stock from unpaid orders |
| `/api/cron/outbox` | every 2 min | Retries messages a provider was down for |
| `/api/cron/carts` | every 15 min | Automatic cart reminders, if switched on |
| `/api/cron/digest` | daily, 02:30 UTC | The 08:00 IST morning email |

On Vercel, add them to `vercel.json` under `crons`.

## 4. Meta setup (WhatsApp and lead ads)

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
   `https://rootwear.in/api/webhooks/meta` with your `META_VERIFY_TOKEN`, then
   subscribe WhatsApp to **messages**. For lead ads, also subscribe the
   Facebook Page to **leadgen**.
5. Submit these message templates in WhatsApp Manager. The name, language
   (`en`) and the order of `{{1}}, {{2}}…` must match admin → Messages →
   Templates:

| Template name | Category | Variables in order |
|---|---|---|
| `order_confirmed` | Utility | name, order number, total, order link |
| `order_dispatched` | Utility | name, order number, courier, tracking, order link |
| `balance_due` | Utility | name, drop name, balance, due date, pay link |
| `cart_reminder` | Marketing | name, items, cart link |
| `drop_live` | Marketing | name, drop name, drop link |
| `broadcast` | Marketing | name, message |

Marketing templates need the customer's opt-in. Checkout does not ask for
WhatsApp consent yet; add a consent line there before switching on WhatsApp
cart reminders or broadcasts.

## 5. First sign-in

1. Create the owner: `ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_ROLE=owner node scripts/create-admin.mjs`
   (Trone's existing `layout` account becomes a person with the "Edit site
   layout" permission automatically.)
2. Sign in at `/admin`, then Settings → Business & GST: check the address and
   state. Turn on GST and enter the GSTIN when it arrives; invoices issued
   before then stay as they were.
3. Settings → Staff → Add person for anyone else. The presets (Packing,
   Support, Accountant, Layout) are starting points; tick and untick freely.
4. Settings → Alerts & digest: choose who gets the morning email.

## 6. Check before launch

- **Drop 01 is published.** The homepage now shows the newest *published*
  live drop, so a drop being prepared can never take it over. If Drop 01
  were unpublished it would still show, as long as no other live drop is
  published. Publish it from Drops to be sure.
- Every product has a **hero cut-out** photo (transparent PNG) if its page
  should float the garment over the name, as Drop 01 does.
- Policy pages: they are served from the code until someone edits one in
  Layout → Pages.
