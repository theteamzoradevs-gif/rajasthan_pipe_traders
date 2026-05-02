# Frontend API integration guide

This document describes the public HTTP API for categories and products: **endpoints**, **query parameters**, **response envelopes**, and **every field** returned in JSON.

## Base URL

Use the backend origin your environment points to, for example:

- Local: `http://localhost:3000` (or the port in `PORT` / `.env`)
- Production: your deployed API host

All paths below are relative to that origin. Responses are **JSON** with `Content-Type: application/json`.

---

## Conventions

| Item | Detail |
|------|--------|
| HTTP methods | `GET` only for categories and products in this guide |
| IDs | MongoDB `_id` values are returned as strings in JSON |
| Dates | `createdAt`, `updatedAt`, and nested dates (e.g. `pricing.priceListEffectiveDate`) are ISO-8601 strings |
| Success envelope | Single resource: `{ "data": <object> }`. List of categories: `{ "data": <array> }`. Product list: `{ "data": <array>, "meta": { ... } }` |
| Errors | `{ "message": string }` (and HTTP status). Server errors may also surface Mongoose messages. |

---

## Health check

| | |
|---|---|
| **Endpoint** | `GET /health` |
| **Response** | `{ "ok": true }` |

---

## Categories

### List categories

| | |
|---|---|
| **Endpoint** | `GET /api/categories` |
| **Query** | `includeInactive` (optional) — if `true`, inactive categories are included. Default: only `isActive: true`. |
| **Success** | `200` — `{ "data": Category[] }` |
| **Sort** | `sortOrder` ascending, then `name` ascending |

### Get one category by slug

| | |
|---|---|
| **Endpoint** | `GET /api/categories/:slug` |
| **Path** | `slug` — category slug (case-insensitive in practice; stored lowercase), e.g. `premium-cable-nail-clips` |
| **Success** | `200` — `{ "data": Category }` |
| **Errors** | `400` missing slug · `404` not found |

---

## Category object (`Category`)

Returned in `data` (single) or each element of `data` (list). `parent` is populated with only `name` and `slug` (plus `_id`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | yes | MongoDB document id |
| `name` | string | yes | Display name |
| `slug` | string | yes | Stable URL key (lowercase) |
| `description` | string \| omitted | no | Optional text |
| `parent` | object \| null | no | Parent category: `{ "_id", "name", "slug" }` or `null` |
| `sortOrder` | number | yes | Display order (default `0`) |
| `sourceSectionLabel` | string \| omitted | no | PDF section label from price list seed |
| `isActive` | boolean | yes | Whether the category is active |
| `createdAt` | string (ISO date) | yes | From Mongoose timestamps |
| `updatedAt` | string (ISO date) | yes | From Mongoose timestamps |

**Example (truncated):**

```json
{
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "name": "Premium cable nail clips (HITECH / TEJAS CRAFT)",
      "slug": "premium-cable-nail-clips",
      "parent": null,
      "sortOrder": 10,
      "sourceSectionLabel": "HITECH SQUARE OR TEJAS CRAFT PREMIUM CABLE NAIL CLIPS (SIZES)",
      "isActive": true,
      "createdAt": "2026-04-01T12:00:00.000Z",
      "updatedAt": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

## Products

### List products

| | |
|---|---|
| **Endpoint** | `GET /api/products` |
| **Query** | See table below |
| **Success** | `200` — `{ "data": Product[], "meta": { "total", "limit", "skip" } }` |
| **Sort** | `sku` ascending |
| **Errors** | `404` if `categorySlug` is provided but no category matches |

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `categorySlug` | string | — | Filter by category `slug` (e.g. `pp-solid-ball-valve`) |
| `productKind` | string | — | `sku` or `catalog` — filter line-item SKUs vs catalog storefront rows |
| `isActive` | string | — | Pass `false` to include inactive products; otherwise only active |
| `limit` | number | `100` | Page size (clamped 1–500) |
| `skip` | number | `0` | Offset for pagination |

`meta.total` is the count of documents matching the same filter (not only the current page).

### Get one product

| | |
|---|---|
| **Endpoint** | `GET /api/products/:identifier` |
| **Path** | `identifier` — resolved in order: (1) MongoDB `_id` if valid ObjectId, (2) **SKU** (case-insensitive, stored uppercase), (3) **slug** (catalog products, lowercase) |
| **Success** | `200` — `{ "data": Product }` |
| **Errors** | `400` empty identifier · `404` not found |

Examples:

- `GET /api/products/674a1b2c3d4e5f6789012345`
- `GET /api/products/CNC-4MM`
- `GET /api/products/cable-nail-clips` (catalog slug → `productKind: "catalog"`)

---

## Product object (`Product`)

Each item in `data` or the single `data` object. `category` is populated with `name` and `slug` (and `_id`).

Many fields are **omitted** when empty (especially for `productKind: "sku"` line items).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | MongoDB document id |
| `sku` | string | Unique stock-keeping id (uppercase). Catalog rows use `CAT-<SLUG-UPPERCASE>` (e.g. `CAT-CABLE-NAIL-CLIPS`) |
| `productKind` | `"sku"` \| `"catalog"` | `sku` = price-list line; `catalog` = grouped product with `sizes` / optional `sellers` |
| `slug` | string \| omitted | Present mainly on `catalog` products (URL slug) |
| `legacyId` | number \| omitted | Legacy numeric id from storefront seed (catalog) |
| `alternateSkus` | string[] | Alternate codes |
| `name` | string | Product title |
| `description` | string \| omitted | Short description |
| `longDescription` | string \| omitted | Long copy (typically catalog) |
| `subCategory` | string \| omitted | Subcategory label (catalog) |
| `category` | object | `{ "_id", "name", "slug" }` (populated) |
| `brand` | string \| omitted | Brand / house line |
| `brandCode` | string \| omitted | Short brand code (catalog) |
| `productLine` | string \| omitted | Line or family name |
| `sizeOrModel` | string \| omitted | Primary size or model label; for catalog often first variant label |
| `features` | string[] \| omitted | Bullet features (catalog) |
| `image` | string \| omitted | Primary image path/URL (often relative e.g. `/Cable_Clip.png`) |
| `images` | string[] \| omitted | Gallery paths/URLs |
| `isNew` | boolean | New flag (default `false`) |
| `isBestseller` | boolean \| omitted | Bestseller flag when set |
| `tags` | string[] \| omitted | Tags for search/filter UI |
| `certifications` | string[] \| omitted | e.g. `["ISI Certified"]` |
| `material` | string \| omitted | Material description |
| `minOrder` | string \| omitted | Minimum order text (e.g. GST note) |
| `moq` | number \| omitted | Minimum order quantity if set |
| `note` | string \| omitted | Product-specific note (e.g. 2% discount line) |
| `listNotes` | string \| omitted | Broader list / PDF discount note |
| `discountTiers` | `DiscountTier[]` \| omitted | Volume discount steps |
| `sizes` | `ProductSize[]` \| omitted | Variant grid (catalog); each row is a buyable size/price |
| `sellers` | `ProductSellerOffer[]` \| omitted | Per-seller offers (e.g. Hitech vs Tejas) with their own `sizes` and tiers |
| `pricing` | `Pricing` | Always present — representative row; for catalog usually first size |
| `packaging` | `Packaging` | Packing / unit metadata (often filled for `sku` rows) |
| `isActive` | boolean | Whether the product is active |
| `sourceDocument` | string | Provenance string (price list / catalog) |
| `createdAt` | string (ISO) | Created timestamp |
| `updatedAt` | string (ISO) | Updated timestamp |

### Nested: `Pricing`

| Field | Type | Description |
|-------|------|-------------|
| `basicPrice` | number | Price before GST |
| `priceWithGst` | number | Price including GST |
| `currency` | string | Default `"INR"` |
| `priceListEffectiveDate` | string (ISO) \| omitted | Price list effective date |

### Nested: `Packaging`

All optional numbers unless noted. Often populated for `productKind: "sku"`.

| Field | Type | Description |
|-------|------|-------------|
| `innerBoxPacking` | number | PCS per inner box |
| `pcsInCartoon` | number | PCS in master carton |
| `pcsPerPacket` | number | Pieces per packet |
| `packetsInMasterBag` | number | Packets in master bag |
| `pktInMasterBag` | number | Alias used on some PDF rows |
| `pcsInPacket` | number | Pieces per packet (explicit) |
| `pcsPerBox` | number | PCS per box |
| `boxesInMasterCartoon` | number | Boxes per master carton |
| `masterCartoonQty` | number | Master carton quantity |
| `pricingUnit` | string | One of: `per_piece`, `per_packet`, `per_box`, `per_cartoon`, `per_dozen`, `per_bag`, `per_master_bag`, `other` |
| `notes` | string | Free-text packing note |

### Nested: `DiscountTier`

| Field | Type | Description |
|-------|------|-------------|
| `qty` | string | Tier label (e.g. `"15 Cartons / Bags"`) |
| `discount` | string | Discount label (e.g. `"7%"`) |

### Nested: `ProductSize` (catalog `sizes[]`)

| Field | Type | Description |
|-------|------|-------------|
| `size` | string | Variant label (e.g. `4MM`, `1 Modular (PMB1)`) |
| `basicPrice` | number | Basic price for that variant |
| `priceWithGst` | number | Price with GST |
| `qtyPerBag` | number \| omitted | Quantity per bag / master pack (PDF column) |
| `pcsPerPacket` | number \| omitted | Pieces per packet |
| `note` | string \| omitted | Variant note (e.g. `"Net Price"`) |

### Nested: `ProductSellerOffer` (catalog `sellers[]`)

| Field | Type | Description |
|-------|------|-------------|
| `sellerId` | string | Stable seller key |
| `sellerName` | string | Display name |
| `brand` | string | Brand label for that offer |
| `sizes` | `ProductSize[]` | Prices/packing for that seller |
| `discountTiers` | `DiscountTier[]` | Seller-specific tiers |
| `minOrder` | string \| omitted | Min order text |
| `note` | string \| omitted | Seller/offer note |

---

## Error responses

| Status | When | Body |
|--------|------|------|
| `400` | Bad request (e.g. missing slug) | `{ "message": "..." }` |
| `404` | Category or product not found | `{ "message": "..." }` |
| `500` | Server / database error | `{ "message": "..." }` |

---

## Frontend usage tips

1. **Storefront vs price list** — Use `productKind=catalog` for marketing/product-detail pages (embedded `sizes`, `sellers`). Use `productKind=sku` or no filter for granular SKUs aligned with the PDF line items.
2. **Pagination** — Use `limit` + `skip` with `meta.total` for product lists.
3. **Images** — Values may be site-relative paths; prefix with your CDN or public site base URL as needed.
4. **CORS** — If the frontend is on another origin, enable CORS on the Express app (not covered here).

---

## Quick reference

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/api/categories` | List categories |
| `GET` | `/api/categories/:slug` | One category |
| `GET` | `/api/products` | List products (filters + pagination) |
| `GET` | `/api/products/:identifier` | One product by id, SKU, or slug |
