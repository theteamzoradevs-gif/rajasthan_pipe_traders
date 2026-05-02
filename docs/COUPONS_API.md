# Coupons — API reference

Coupons are stored in MongoDB (`Coupon` model). Set `MONGODB_URI` in `.env.local` (see [RUNNING_THE_PROJECT.md](./RUNNING_THE_PROJECT.md)).

**Local base URL (default Next.js dev):** `http://localhost:3000`  
Replace with your deployed origin in production.

---

## Public (storefront)

### List coupons (banner / cart)

| | |
|---|---|
| **Method** | `GET` |
| **Path** | [`/api/coupons`](http://localhost:3000/api/coupons) |

**Query parameters**

| Param | Values | Effect |
|--------|--------|--------|
| `banner` | `1` or `true` | Only coupons with `displayInBanner: true` |
| `cart` | `1` or `true` | Only coupons with `showInCart: true` |

You can combine both flags. Only **active** coupons inside **`startAt` / `endAt`** (when set) are returned.

**Example URLs**

- Hero banner strip: [http://localhost:3000/api/coupons?banner=1](http://localhost:3000/api/coupons?banner=1)
- Cart picker: [http://localhost:3000/api/coupons?cart=1](http://localhost:3000/api/coupons?cart=1)
- All active public coupons (both flags): [http://localhost:3000/api/coupons?banner=1&cart=1](http://localhost:3000/api/coupons?banner=1&cart=1)

**Response** `200`

```json
{
  "data": [
    {
      "code": "BULK7",
      "discount": "7%",
      "label": "OFF",
      "condition": "On 15+ Cartons / Bags",
      "desc": "Mix items · complete price list",
      "theme": "blue",
      "offerAppliesTo": "Cartons & bags (per price list)"
    }
  ]
}
```

`offerAppliesTo` is omitted when empty. It is display-only (e.g. wording aligned with your price list PDF).

---

### Validate coupon against a cart

| | |
|---|---|
| **Method** | `POST` |
| **Path** | [`/api/coupons/validate`](http://localhost:3000/api/coupons/validate) |
| **Headers** | `Content-Type: application/json` |

**Body**

```json
{
  "code": "BULK7",
  "lines": [
    {
      "productMongoId": "674a…",
      "categoryMongoId": "674b…",
      "quantity": 20,
      "lineSubtotal": 15000.5
    }
  ]
}
```

- `productMongoId` / `categoryMongoId` — optional strings; used when the coupon is restricted to specific products or categories.
- `lineSubtotal` — typically `quantity * pricePerUnit` (incl. GST), matching your cart line.

**Success** `200`

```json
{
  "valid": true,
  "discountAmount": 1050,
  "freeDispatch": false,
  "freeShipping": false,
  "eligibleSubtotal": 15000,
  "eligibleQuantity": 20,
  "eligibleLineCount": 1
}
```

**Not applicable** `200` (logical failure, not HTTP error)

```json
{
  "valid": false,
  "reason": "Minimum quantity 15 on eligible items not met"
}
```

**Errors** `400` / `500` — `{ "message": "…" }`

---

## Admin (CRUD)

There is **no separate auth layer** in this project; these routes are the same as other `/api/admin/*` endpoints. Protect them at the edge (VPN, reverse proxy, etc.) if the app is public.

**Admin UI:** [http://localhost:3000/admin/coupons](http://localhost:3000/admin/coupons)

### List coupons

| | |
|---|---|
| **Method** | `GET` |
| **Path** | [`/api/admin/coupons`](http://localhost:3000/api/admin/coupons) |

**Query parameters**

| Param | Values |
|--------|--------|
| `isActive` | `true` or `false` (optional filter) |

**Example:** [http://localhost:3000/api/admin/coupons](http://localhost:3000/api/admin/coupons)  
**Example:** [http://localhost:3000/api/admin/coupons?isActive=true](http://localhost:3000/api/admin/coupons?isActive=true)

**Response** `200` — `{ "data": [ …full coupon documents with populated product/category refs… ] }`

---

### Create coupon

| | |
|---|---|
| **Method** | `POST` |
| **Path** | [`/api/admin/coupons`](http://localhost:3000/api/admin/coupons) |
| **Headers** | `Content-Type: application/json` |

**Body (main fields)**

| Field | Type | Notes |
|--------|------|--------|
| `code` | string | Required; stored uppercase |
| `discountType` | string | `percentage` \| `fixed_amount` \| `free_dispatch` \| `free_shipping` |
| `discountPercent` | number | Required for `percentage` (0–100) |
| `fixedAmountOff` | number | Required for `fixed_amount` (INR) |
| `displayPrimary` | string | Required; hero stub main text |
| `displaySecondary` | string | Hero stub secondary |
| `title` | string | Required; condition line |
| `description` | string | |
| `themeKey` | string | `blue` \| `indigo` \| `green` \| `amber` \| `brown` |
| `offerAppliesTo` | string | Optional; shown on storefront cards (e.g. cartons/bags per price list); display-only |
| `applicableProductIds` | string or string[] | Comma/whitespace-separated ObjectIds or array |
| `applicableCategoryIds` | string or string[] | Same; empty = all |
| `minOrderValue` | number | On **eligible** lines (INR) |
| `minTotalQuantity` | number | Sum of qty on eligible lines |
| `minEligibleLines` | number | Count of eligible lines with quantity greater than 0 |
| `startAt` | ISO string or null | |
| `endAt` | ISO string or null | |
| `isActive` | boolean | Default `true` |
| `displayInBanner` | boolean | Default `true` |
| `showInCart` | boolean | Default `true` |
| `sortOrder` | number | |
| `name` | string | Internal label |
| `internalNotes` | string | |

**Response** `200` — `{ "data": { …created coupon… } }`  
**Errors** `400`, `409` (duplicate code), `500`

---

### Get one coupon

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/admin/coupons/:id` |

**Example:** `http://localhost:3000/api/admin/coupons/674a1b2c3d4e5f6789abcdef` (replace with real MongoDB `_id`)

**Response** `200` — `{ "data": { … } }`  
**Errors** `400`, `404`, `500`

---

### Update coupon

| | |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/admin/coupons/:id` |
| **Headers** | `Content-Type: application/json` |

Send only fields to change. To clear **offer applies to**, send `"offerAppliesTo": ""`.

**Response** `200` — `{ "data": { … } }`  
**Errors** `400`, `404`, `409`, `500`

---

### Delete coupon

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/admin/coupons/:id` |

**Response** `200` — `{ "data": { "_id": "…", "deleted": true } }`  
**Errors** `400`, `404`, `500`

---

## Quick link summary

| Purpose | Link |
|--------|------|
| List (public) | http://localhost:3000/api/coupons |
| List for hero | http://localhost:3000/api/coupons?banner=1 |
| List for cart | http://localhost:3000/api/coupons?cart=1 |
| Validate | http://localhost:3000/api/coupons/validate (POST) |
| Admin list / create | http://localhost:3000/api/admin/coupons |
| Admin get / patch / delete | http://localhost:3000/api/admin/coupons/:id |
| Admin UI | http://localhost:3000/admin/coupons |

---

## Related code

- Model: `lib/db/models/Coupon.ts`
- Rules: `lib/coupons/evaluate.ts`, `lib/coupons/couponPayload.ts`
- Serialization: `lib/db/serialize.ts` (`serializeCouponLean`)
