# Postmark Setup

This project uses Shopify for purchase/receipt emails and this Node app for follow-up vote emails.

Postmark is the delivery provider for the vote emails. The app still generates:
- the vote token
- the vote link
- the email HTML
- the send trigger

Postmark is responsible for reliable delivery.

## Goal

The intended flow is:

1. Customer buys on Shopify.
2. Shopify sends the normal receipt/order emails.
3. You collect the customer's email address.
4. In this app's admin, you create/send a vote email.
5. The app creates a token.
6. The app generates a vote link like `https://ladderice.co/?token=...`.
7. The app renders the email HTML.
8. Postmark sends the email.
9. Customer clicks the link and votes on the campaign site.

## Current Integration

The current codebase is set up so Postmark is used through SMTP.

Relevant files:
- [mailer.js](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/mailer.js)
- [index.js](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/index.js)
- [dashboard.html](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/views/dashboard.html)
- [.env.example](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/.env.example)

Important detail:
- Postmark does not generate the token.
- Postmark does not generate the vote URL.
- This app does both, then hands the final email to Postmark for delivery.

## Step 1: Create Postmark Account

1. Sign up at `https://postmarkapp.com`.
2. Create a new Postmark server for this project.
3. Name it something like `Ladderice Vote Emails`.

## Step 2: Verify Sender

You need a verified sender before Postmark will deliver email properly.

Recommended:
- verify the domain or subdomain you want to send from

Recommended sender:
- `vote@ladderice.co`

Best practice:
- use a dedicated sending address for vote emails
- keep it separate from personal/admin inboxes

Postmark will give you DNS records to add.

## Step 3: Configure DNS

In your DNS provider, add the Postmark records they provide.

Usually this includes:
- DKIM record(s)
- Return-Path / tracking domain record(s)

You should also make sure your domain has:
- SPF
- DKIM
- DMARC

Recommended DMARC starter record:

```txt
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:admin@ladderice.co; adkim=s; aspf=s
```

After DNS is live, verify the sender/domain in Postmark.

## Step 4: Get the Postmark Server Token

Inside the Postmark server:

1. Open the server settings.
2. Copy the `Server API Token`.

For this app's SMTP usage:
- SMTP host: `smtp.postmarkapp.com`
- SMTP port: `587`
- SMTP username: `Server API Token`
- SMTP password: `Server API Token`

## Step 5: Configure the App

You can configure Postmark in either of two ways.

### Option A: Enter Settings in the Admin UI

Open the app admin email tab and enter:

- `SMTP Host`: `smtp.postmarkapp.com`
- `SMTP Port`: `587`
- `SMTP Username`: your Postmark `Server API Token`
- `SMTP Password`: your Postmark `Server API Token`
- `From Email`: `vote@ladderice.co`
- `From Name`: `Ladderice Campaign`
- `Campaign Website URL`: `https://ladderice.co`

Then click:
- `Save SMTP Settings`
- `Test Email`

### Option B: Use Environment Variables

Set these in [server/.env](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/.env):

```env
POSTMARK_SERVER_TOKEN=your-postmark-server-token
POSTMARK_FROM_EMAIL=vote@ladderice.co
POSTMARK_FROM_NAME=Ladderice Campaign
POSTMARK_SMTP_HOST=smtp.postmarkapp.com
POSTMARK_SMTP_PORT=587
SITE_URL=https://ladderice.co
```

Then restart the app.

The app maps these into its internal SMTP settings on first boot if the SMTP fields are empty.

## Step 6: Restart the App

If you are running with Docker, rebuild/restart:

```bash
docker compose up -d --build
```

If you are running locally from `server/`:

```bash
npm run dev
```

## Step 7: Send a Test Email

In the admin:

1. Go to the email tab.
2. Enter a test recipient.
3. Click `Test Email`.

What should happen:
- the app renders the email
- the app sends it through Postmark SMTP
- Postmark delivers it

If this fails, check:
- Postmark sender/domain verification
- SMTP token correctness
- DNS propagation
- `From Email` matches a verified sender/domain

## How the Vote Email Process Works

The process is:

1. You enter or import a customer email.
2. The app creates a token in the `vote_tokens` table.
3. The app builds a URL:

```txt
https://ladderice.co/?token=TOKEN_VALUE
```

4. The app renders the email HTML in `server/mailer.js`.
5. The app sends that HTML through Postmark SMTP.
6. The customer receives the email.
7. The customer clicks the vote link.
8. The frontend calls the token validation API.
9. The customer votes once.
10. The token/order is marked as used.

## Which System Owns What

Shopify owns:
- checkout
- payment
- order confirmation / receipt emails

This app owns:
- vote token creation
- vote email content
- vote link generation
- vote validation
- vote submission

Postmark owns:
- email transport
- deliverability infrastructure
- bounce/complaint handling

## Template Ownership

Right now the vote email template is in code, not in Postmark.

That means:
- design/layout lives in `server/mailer.js`
- the subject/body text is partially editable in the admin
- the token and vote link are always generated by the app

This is the current behavior:

1. App creates token.
2. App builds vote link.
3. App renders email.
4. Postmark sends email.

If needed later, this can be moved to Postmark templates, but the token and link would still need to come from the app.

## Recommended Operating Process

For now, the cleanest manual process is:

1. Customer purchases on Shopify.
2. Shopify sends the receipt.
3. You copy the customer email from Shopify.
4. In this app, create a token for that customer.
5. Send the vote email from this app.

This avoids trying to force product-specific campaign logic into Shopify's built-in email system.

## Deliverability Notes

Postmark helps reduce spam risk, but you still need:
- verified sending domain
- SPF
- DKIM
- DMARC
- consistent sender address
- transactional, relevant email content

Recommended sender:
- `vote@ladderice.co`

Recommended sender name:
- `Ladderice Campaign`

## Useful Links

- Postmark SMTP setup: `https://postmarkapp.com/support/article/1097-how-do-i-send-email-using-smtp`
- Postmark sender signatures: `https://postmarkapp.com/support/article/1180-creating-sending-signatures`
- Postmark DNS configuration: `https://postmarkapp.com/support/article/1026-postmark-dns-configuration`
- Postmark SPF/DKIM guide: `https://postmarkapp.com/support/article/1091-how-do-i-set-up-spf-for-postmark`
- Shopify notifications overview: `https://help.shopify.com/en/manual/orders/notifications/edit-template`

## Possible Next Improvement

A useful next change in this repo would be:

- add one admin action where you enter a customer email and name
- the app creates the token and sends the vote email in one step

That would remove the current two-step manual flow.
