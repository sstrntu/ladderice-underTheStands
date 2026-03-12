# Shopify Setup

This document reflects the current Shopify plan and the latest campaign-site design in this repo.

## Current Architecture

Shopify is responsible for:
- product catalog
- variant selection
- checkout
- payment
- standard order / receipt emails

This app is responsible for:
- the campaign landing page
- custom product presentation
- Buy Now buttons that send users into Shopify
- vote-token email flow
- vote validation and vote submission

## Latest Design

The current campaign-site design is not a Shopify storefront theme experience.

It is a custom campaign page with:
- `Product 1` as the featured hero / carousel product
- `Products 2-6` shown as editorial jersey rows
- CMS-managed text, price, imagery, and Buy Now behavior
- a separate post-purchase vote experience

Design behavior:
- `Product 1` is the main campaign product shown in the featured section
- `Products 2-6` appear in the magazine-style collection layout
- each product has custom content and imagery managed in the app admin
- Buy Now should send users from the campaign page into Shopify checkout

Relevant files:
- [index.html](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/views/index.html)
- [dashboard.html](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/server/views/dashboard.html)
- [product.json](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/theme/templates/product.json)

## Store Domain

Current Shopify store domain:

```txt
8450d8-3.myshopify.com
```

## Product 1 Test Mapping

Confirmed test product:

- Shopify product URL: `https://ladderice.co/products/ladderice-uts-1?variant=45701810061498`
- Product ID: `8347905458362`
- Variant ID: `45701810061498`

Current intended Buy Now target for Product 1:

```txt
https://8450d8-3.myshopify.com/cart/45701810061498:1
```

This uses a Shopify cart permalink with quantity `1`.

## How Buy Now Works

The intended flow is:

1. User clicks `Buy Now` on the campaign site.
2. The app maps that product to a Shopify variant ID.
3. The app builds a Shopify cart URL:

```txt
https://<store-domain>/cart/<variant_id>:1
```

4. Shopify opens with that item preloaded.
5. Customer completes checkout in Shopify.

## Why Variant IDs Matter

The campaign site should not rely on manual product links alone.

Each Buy Now product should have:
- a Shopify variant ID
- optionally a manual fallback link

Variant ID is required because checkout/cart links are variant-based, not product-based.

## Recommended Data Per Product

For each campaign product, store:
- display name
- display price
- Shopify product handle
- Shopify variant ID
- optional manual fallback URL

If the product has size or color options, store:
- all variant IDs
- option labels for each variant

## Current CMS Direction

The admin already stores campaign-specific content for products 1-6.

The next Shopify-safe direction is:
- add a Shopify variant ID field for each product
- generate Buy Now URLs from that field
- keep manual product URLs only as fallback

Current status:
- Product 1 has been prepared for this pattern first
- Products 2-6 should follow the same structure

## Shopify Email Strategy

Shopify should handle:
- order confirmation
- receipt emails
- standard transactional checkout notifications

Important limitation:
- Shopify does not support truly separate native order-confirmation templates per product

What Shopify can do:
- one order-confirmation template
- product-specific conditional content inside that template using Liquid

What this project is doing instead:
- use Shopify for the standard receipt
- use this app for the separate vote/campaign follow-up email

This is the cleaner fit for the current design.

## Vote Email Strategy

The current decision is:

1. Shopify sends the purchase receipt.
2. You take the customer email from Shopify.
3. In the admin app, you create/send the vote email.
4. The app generates a token and vote link.
5. Postmark sends the vote email.

See also:
- [POSTMARK_SETUP.md](/Users/sirasasitorn/Documents/VScode/ladderice-underTheStands/POSTMARK_SETUP.md)

## Thailand-Only Shipping

If you want only this Shopify product to ship in Thailand:

1. Create a custom shipping profile in Shopify.
2. Add only that product to the profile.
3. Keep only `Thailand` as the shipping zone.

If you edit the general shipping profile instead, the restriction can affect the whole store.

## How To Get Variant IDs

Fastest methods:

1. Open the live product URL and read the `?variant=` query param.
2. Open the Shopify Admin variant page and copy the number after `/variants/`.
3. Export products from Shopify and use the `Variant ID` column.

Example:

```txt
https://ladderice.co/products/ladderice-uts-1?variant=45701810061498
```

Variant ID:

```txt
45701810061498
```

## Recommended Next Steps

1. Confirm variant IDs for Products 2-6.
2. Add a variant ID field for all campaign products in the admin.
3. Generate Shopify cart URLs for all Buy Now buttons.
4. Keep Shopify for receipts.
5. Use Postmark + this app for vote emails.

## Notes

The Shopify theme inside `theme/` exists, but the campaign-site purchase experience described above is currently driven by the custom server-rendered campaign page rather than the Shopify theme product template.
