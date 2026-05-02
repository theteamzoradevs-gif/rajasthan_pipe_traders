# Admin products API — create, update, delete

This document describes the **HTTP contract** the admin UI in `app/admin/products/page.tsx` expects. Use it when implementing or porting the backend (Next.js route handlers under `app/api/admin/products/`, or a standalone Node/Express API).

For general API conventions (envelopes, IDs, population), see **`docs/BACKEND_API_GUIDE.md`**. For catalog JSON shapes (`sizes`, `sellers`, `discountTiers`), see **`docs/FRONTEND_API_INTEGRATION.md`**.

---

## 1. Endpoints overview

| Action | Method | Path | Used by |
|--------|--------|------|---------|
| Create | `POST` | `/api/admin/products` | New product form submit |
| Update | `PATCH` | `/api/admin/products/:id` | Edit product form submit (`id` = MongoDB `ObjectId` string) |
| Delete | `DELETE` | `/api/admin/products/:id` | Delete button |

The admin page also uses **`GET /api/admin/products`** (list with `limit`, `skip`) and **`GET /api/admin/products/:id`** (load one product for edit). Those are documented implicitly below where they share response shapes.

---

## 2. JSON conventions

- **Success (single resource):** `{ "data": <product> }`  
- **Success (delete):** `{ "data": { "_id": "<id>", "deleted": true } }`  
- **Error:** `{ "message": "<human-readable string>" }` with a 4xx/5xx status.

The UI reads `json.message` on failure (`res.ok` is false).

- **`category` on product:** populated object `{ "_id", "name", "slug" }` (not only an ObjectId string).
- **`_id`:** string in JSON.

---

## 3. Create — `POST /api/admin/products`

### Request headers

- `Content-Type: application/json`

### Body (what the admin form sends)

All string fields are trimmed on the client before send (SKU uppercased, slug lowercased when present).

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `sku` | string | yes | Client sends uppercase |
| `name` | string | yes | |
| `productKind` | `"sku"` \| `"catalog"` | implied | Default server-side if omitted: `"sku"` |
| `slug` | string | no | Omitted or empty means “no slug”; otherwise lowercase |
| `category` | string | **yes** | **Category `_id` as hex ObjectId string** (not `{ _id: ... }`) |
| `description` | string | no | May be omitted when empty |
| `brand` | string | no | |
| `image` | string | no | Primary image URL (e.g. Cloudinary) |
| `isActive` | boolean | no | Default `true` if omitted |
| `isNew` | boolean | no | Default `false` if omitted |
| `pricing` | object | **yes** | See below |
| `discountTiers` | array | no | Only sent if the JSON textarea is non-empty |
| `sizes` | array | no | Same |
| `sellers` | array | no | Same |
| `images` | string[] | always | Gallery URLs; may be `[]` |

**`pricing` object:**

| Field | Type | Required |
|-------|------|----------|
| `basicPrice` | number | yes |
| `priceWithGst` | number | yes |
| `currency` | string | no (default `INR`) |

### Server-side validation (minimum)

1. `sku`, `name` non-empty after trim.
2. `category` is a valid `ObjectId` and references an existing category.
3. `pricing.basicPrice` and `pricing.priceWithGst` are **numbers** (not numeric strings — the client sends JSON numbers).
4. Optional: validate `productKind`, `sizes` / `sellers` / `discountTiers` against schemas in `lib/db/models/Product.ts` / docs.

### Success response

- Status **200** (current Next implementation) or **201** — be consistent across your API.
- Body: `{ "data": <serialized product with populated category> }`.

### Error cases

| Situation | Suggested status |
|-----------|------------------|
| Missing/invalid `sku`, `name`, `category`, or `pricing` | 400 |
| Category id valid but not found | 400 |
| Duplicate `sku` or sparse unique `slug` (MongoDB index) | 409 |
| Server failure | 500 |

**Reference implementation:** `app/api/admin/products/route.ts` → `POST`.

---

## 4. Update — `PATCH /api/admin/products/:id`

### Path parameter

- `id`: MongoDB `ObjectId` hex string. Invalid id → **400** with `{ "message": "Invalid product id" }` (or equivalent).

### Request body

Partial update: only fields present in the body are applied. The admin UI sends a **full snapshot** of the editable fields on save (same shape as create), including:

- Scalars: `sku`, `name`, `productKind`, `slug`, `description`, `brand`, `image`, `isActive`, `isNew`, `category` (ObjectId string), `pricing` (partial numeric updates allowed on server).
- Arrays: `images` (always sent as string array), `discountTiers`, `sizes`, `sellers` when the corresponding JSON textareas had content (if empty, those keys may be omitted — your PATCH handler should define whether “omit” means “leave unchanged” vs “clear”; the Next handler sets fields when `!== undefined`).

**`pricing` on PATCH (Next behavior):** Only keys that are **numbers** (`basicPrice`, `priceWithGst`) or **string** (`currency`) are merged; partial `pricing` objects are supported.

**`image` clearing (Next behavior):** `image: null` or `image: ""` can unset the field (`$unset`).

**`images` clearing (Next behavior):** `images: null` unsets gallery; array replaces gallery.

### Success response

- **200** + `{ "data": <updated product, populated category> }`.

### Error cases

| Situation | Suggested status |
|-----------|------------------|
| Invalid `id` | 400 |
| Product not found | 404 |
| `category` sent but invalid / not found | 400 |
| Duplicate `sku` / `slug` | 409 |
| Server failure | 500 |

**Reference implementation:** `app/api/admin/products/[id]/route.ts` → `PATCH`.

---

## 5. Delete — `DELETE /api/admin/products/:id`

### Path parameter

- Same `id` rules as PATCH.

### Request body

- None.

### Success response

- **200** + `{ "data": { "_id": "<id>", "deleted": true } }`  
  The UI only checks `res.ok` and reloads the list; it does not depend on the inner shape beyond JSON parsing.

### Error cases

| Situation | Suggested status |
|-----------|------------------|
| Invalid `id` | 400 |
| Product not found | 404 |
| Server failure | 500 |

**Reference implementation:** `app/api/admin/products/[id]/route.ts` → `DELETE`.

---

## 6. Data model alignment

Mongoose schema: **`lib/db/models/Product.ts`**.

Important indexes/constraints:

- `sku` — **unique**
- `slug` — **unique, sparse** (multiple documents can have no slug)

After create/update, return the product in the same serialized shape as list/detail GET (e.g. **`serializeProductLean`** in `lib/db/serialize.ts`) so the admin table and edit form stay consistent.

---

## 7. Checklist for a new backend (e.g. Express)

1. [ ] `POST /api/admin/products` — validate body, ensure category exists, insert product, return `{ data }`.
2. [ ] `PATCH /api/admin/products/:id` — validate `id`, apply partial updates, handle duplicate key errors.
3. [ ] `DELETE /api/admin/products/:id` — validate `id`, delete by `_id`, return `{ data: { _id, deleted: true } }`.
4. [ ] Populate `category` with `{ _id, name, slug }` on responses.
5. [ ] Use the same error envelope `{ message }` as the Next routes.
6. [ ] Protect these routes with admin auth before production (not implemented in the snippet above).

The Next.js routes in this repository already satisfy items 1–5 for local development; item 6 is your deployment concern.
