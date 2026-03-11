# Shopify Vote Integration Handoff

## Current Status

The codebase has been updated to support:

- Shopify-backed vote session creation from a Shopify order confirmation / POS receipt link
- One session token per Shopify order
- Multiple votes per order based on eligible line-item quantity
- Shopify credential configuration via the admin dashboard
- Per-product Shopify product ID mapping via the admin dashboard
- Removal of the hard-coded admin login in favor of env-based credentials

The implementation is in place in the custom Node app under `server/`.

## Main Files Changed

- `server/routes/api.js`
  - Added `GET /api/vote/start`
  - Updated token validation and token voting responses to support `votes_total`, `votes_used`, `votes_remaining`
- `server/database.js`
  - Migrated vote storage from single-vote-per-order to session-based multi-vote support
  - Added Shopify-aware token/session metadata
- `server/shopify.js`
  - Added Shopify Admin API access
  - Supports current Shopify app flow using `client_id` + `client_secret`
  - Keeps static Admin token as optional fallback
- `server/views/index.html`
  - Updated frontend vote flow to handle remaining votes
  - Added handling for `vote_error` query param
- `server/views/dashboard.html`
  - Added Shopify settings fields
  - Added per-product `shopify_product_id` fields
  - Added notification-link template preview
- `server/routes/admin.js`
  - Admin login now uses env credentials
  - Added `/admin/test-shopify`
- `server/package.json`
  - Upgraded `better-sqlite3`
  - Added `engines.node = 22.x`
- `.nvmrc`
  - Added `22.17.0`

## Shopify App Setup State

Confirmed:

- Store domain: `8450d8-3.myshopify.com`
- Shopify app is installed on that store
- Required scopes are already granted
- Shopify app type is Dev Dashboard app using `Client ID` + `Client Secret`

Important:

- The Shopify app secret was pasted in chat during this session.
- It should be rotated in Shopify before production use.
- Do not store the old secret anywhere.

## Runtime / Local Environment Notes

There was a local Node mismatch:

- repo root was using Node `22.17.0`
- `server/` shell PATH was resolving to Node `24.10.0`

This caused `better-sqlite3` ABI mismatches.

Current expected runtime:

- Use Node `22.17.0`
- Run `nvm use` from repo root before working

The native module issue is fixed for Node 22.

Sandbox note:

- Full local server boot could not be completed in-session because the sandbox blocks binding to port `3001`
- The last failure was `listen EPERM`, not an app crash

## Configuration Still Needed

These items are still needed from the user before final Shopify wiring can be completed:

1. Public app URL
- Example: `https://vote.ladderice.co`
- This is needed for the Shopify notification link

2. Eligible Shopify product IDs
- One per vote-eligible product
- These should be entered in the admin dashboard fields:
  - `product_1_shopify_product_id`
  - `product_2_shopify_product_id`
  - etc.

3. App admin credentials for this Node app
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- also recommended: `SESSION_SECRET`

4. Rotated Shopify app secret
- Needed after rotation

5. Final preorder decision and product setup
- Whether to use simple Shopify preorder (`continue selling when out of stock`) or an app-based preorder product flow
- The current recommendation is the simple Shopify preorder path first

## Expected Environment Variables

Recommended env vars for the Node app:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `SITE_URL`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_VERSION`

Optional fallback:

- `SHOPIFY_ADMIN_ACCESS_TOKEN`

SMTP vars still exist for manual email fallback:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

## Shopify Notification Link

The app now expects Shopify notifications to send customers to:

```liquid
{{ shop.url }}/api/vote/start?order_id={{ order.id }}&email={{ email | url_encode }}
```

Do not use `shop.url` blindly unless the vote app is hosted on the same domain/path.

Preferred final format:

```liquid
https://YOUR-VOTE-APP-URL/api/vote/start?order_id={{ order.id }}&email={{ email | url_encode }}
```

This should be added to:

- Shopify Order Confirmation email
- Shopify POS / customer receipt flow

## Shopify Preorder Notes

The user asked whether Shopify can sell a preorder instead of a normal in-stock item.

Current conclusion:

- Yes, Shopify can support a simple preorder flow without extra code changes in this repo
- The shortest path is to configure the Shopify product/variants to keep selling when inventory reaches zero
- This repo's Shopify theme already supports preorder button wording and preorder inventory messaging

Theme evidence already present:

- `theme/templates/product.json`
  - `buy_buttons.settings.show_preorder`
- `theme/sections/main-product.liquid`
  - preorder button label wiring
- `theme/assets/component-product-form.js`
  - preorder wording and inventory handling

Recommended preorder path:

1. Use Shopify's native "continue selling when out of stock" for the eligible preorder products
2. Enable preorder wording in the product template/theme where desired
3. Optionally change the campaign page CTA from `Buy Now` to `Pre-Order`
4. Keep the Shopify-backed vote flow unchanged, since preorder orders are still normal Shopify orders

Still open on preorder:

- Whether preorder should be simple "pay now, ship later"
- Or whether the user wants a more complex preorder app flow with deposits / special handling

## What The Flow Now Does

1. Customer clicks `Buy Now` on the campaign page
2. Customer goes to Shopify product page
3. Customer selects size/color on Shopify and checks out
4. Shopify notification contains vote link
5. Customer clicks vote link
6. `GET /api/vote/start` verifies:
   - order exists
   - order is paid
   - email matches
   - order contains eligible product IDs
7. App creates or reuses a token/session
8. Customer is redirected to `/?token=...`
9. Frontend unlocks voting with remaining-votes support

## Things To Do Next

### 1. Rotate Shopify app secret

- In Shopify app settings, rotate the secret
- Use the rotated secret going forward

### 2. Save final Shopify settings into the app

In the dashboard email/shopify tab, fill in:

- store domain
- API version
- client ID
- rotated client secret
- optional static token fallback blank unless explicitly needed

### 3. Fill in product mappings

For each eligible product:

- set Shopify product URL in `product_n_link`
- set Shopify product ID in `product_n_shopify_product_id`

### 4. Set public app URL

- Set `SITE_URL`
- confirm the final deployed domain/path
- use that in the Shopify notification CTA

### 5. Add env-based admin credentials

- set `ADMIN_USERNAME`
- set `ADMIN_PASSWORD`
- set `SESSION_SECRET`

### 6. Paste Shopify notification snippet

Add the CTA link to:

- Order confirmation
- POS receipt / customer email receipt

### 7. Real-world test

Run this once deployed:

- test ineligible order
- test paid eligible order with 1 item
- test paid eligible order with quantity > 1
- test POS order with captured email
- test repeat click after all votes are consumed

### 8. Decide and implement preorder presentation

If the user wants preorder before final Shopify mapping:

- configure eligible Shopify products to continue selling when out of stock
- optionally enable preorder wording in the Shopify theme
- optionally rename the campaign CTA from `Buy Now` to `Pre-Order`
- verify the preorder flow still lands on the correct Shopify product page and still qualifies for votes after purchase

## Suggested Commands For Next Session

Use Node 22 explicitly:

```bash
nvm use
cd server
npm install
npm start
```

If `better-sqlite3` mismatches again:

```bash
cd server
PATH="$HOME/.nvm/versions/node/v22.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin" npm rebuild better-sqlite3
```

## Open Risks / Follow-Up

- Shopify notification Liquid snippet has not yet been pasted into the actual Shopify notification templates
- Product ID mapping has not yet been filled in
- Public production URL is still unknown
- The Shopify secret should be rotated before production use
- Local port binding was not tested end-to-end in sandbox, only static/runtime module verification
- Preorder has not yet been implemented or configured in Shopify/theme settings
