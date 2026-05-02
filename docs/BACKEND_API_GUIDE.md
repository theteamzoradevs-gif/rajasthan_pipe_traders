# Backend API guide — creating and extending APIs

This guide is for building or extending a **Node.js HTTP API** (typically **Express** + **MongoDB** + **Mongoose**) that serves the Rajasthan Pipe Traders data. It aligns with:

- **`docs/FRONTEND_API_INTEGRATION.md`** — public **read** endpoints and JSON response shapes.
- **`docs/Category.js`** / **`docs/Product.js`** — Mongoose models and fields.

The **Next.js app in this repo** already implements **admin CRUD** at **`/api/admin/*`** using the same Mongoose-style schemas in **`lib/db/models/`**. Use this document when you maintain a **standalone Express API** or add new resources on the server.

---

## 1. Recommended stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+ |
| HTTP | Express (or Fastify — patterns are similar) |
| Database | MongoDB (Atlas or self-hosted) |
| ODM | Mongoose |
| Validation | Zod or Joi (validate body/query before touching the DB) |
| Config | `dotenv` + `process.env` (never commit secrets) |

---

## 2. Project layout (Express)

A clear structure keeps new endpoints consistent:

```
backend/
  src/
    config/          # load env, db connection
    models/          # Mongoose schemas (or re-export from shared package)
    routes/          # mount routers: /api/categories, /api/products
    controllers/     # parse request → call service → set response
    services/        # business logic, queries
    middleware/      # auth, error handler, request id
    validators/      # Zod/Joi schemas
  app.js or server.js
```

**Connection:** Use a single shared Mongo connection (Mongoose `connect` once on startup). For serverless, use a cached connection pattern (similar to `lib/db/connect.ts` in this repo).

---

## 3. API conventions (match the frontend doc)

Stick to these so web and mobile clients stay predictable.

### URLs and methods

- **Public catalog (documented today):** mainly **`GET`** under `/api/categories`, `/api/products`, plus **`GET /health`**. See **`docs/FRONTEND_API_INTEGRATION.md`** for exact paths, query params, and sorting.
- **Mutations (create/update/delete):** for **admin products**, the exact contract the UI uses is in **`docs/ADMIN_PRODUCTS_API_IMPLEMENTATION.md`**. For Express (or similar), common patterns:
  - `POST /api/categories` — create  
  - `PATCH /api/categories/:id` — partial update (or `PUT` for full replace)  
  - `DELETE /api/categories/:id` — delete  
  - Same idea for admin **`/api/admin/products`** using MongoDB **`_id`** in the path.

Use **`/api/admin/...`** only if you intentionally separate **admin** from **public** routes (and protect admin with auth).

### JSON envelopes

| Case | Body shape |
|------|------------|
| Single resource | `{ "data": <object> }` |
| List (categories) | `{ "data": <array> }` |
| List (products) | `{ "data": <array>, "meta": { "total", "limit", "skip" } }` |
| Error | `{ "message": string }` + appropriate **HTTP status** |

### IDs and dates

- Expose **`_id`** as a **string** in JSON.
- Serialize dates as **ISO-8601** strings (`createdAt`, `updatedAt`, nested dates).

### Population

- **Category** `parent`: populate with `{ _id, name, slug }` (or `null`).
- **Product** `category`: populate with `{ _id, name, slug }`.

---

## 4. Adding a new read endpoint (example flow)

Suppose you add **`GET /api/brands`**.

1. **Model** — define `Brand` in Mongoose (schema + indexes).
2. **Route** — `router.get('/brands', listBrands)`.
3. **Controller** — read `req.query`, call service.
4. **Service** — `Brand.find(filter).sort(...).lean()`.
5. **Response** — `res.json({ data: rows })`.
6. **Docs** — append to **`FRONTEND_API_INTEGRATION.md`** (path, query, fields, examples).
7. **Frontend** — `fetch` the new URL; types if you use TypeScript.

---

## 5. Adding create / update / delete (checklist)

1. **Validate input** — required fields, types, enums (`productKind: 'sku' | 'catalog'`, `packaging.pricingUnit`, etc.). Reject unknown fields if you want strict APIs.
2. **Respect schema rules** — e.g. **unique** `Category.slug`, **unique** `Product.sku`, **sparse unique** `Product.slug` for catalog rows (see **`docs/Product.js`**).
3. **References** — `Product.category` must be a valid **`Category`** `_id`.
4. **Partial updates** — prefer **`PATCH`** with MongoDB **dot notation** (`pricing.basicPrice`) so you do not wipe nested objects by mistake.
5. **Delete rules** — e.g. block **category** delete if **`Product.countDocuments({ category }) > 0`** or if child categories exist.
6. **Errors** — map Mongoose duplicate key (**11000**) to **409** with a clear `message`.
7. **Auth** — protect mutation routes (API key, JWT, or session) before production.

---

## 6. Express route sketch (pseudo-code)

```js
// routes/categories.js
router.get('/categories', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const data = await Category.find(filter)
      .populate('parent', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

router.post('/categories', requireAdmin, async (req, res, next) => {
  try {
    const doc = await Category.create(req.body); // validate req.body first
    const populated = await Category.findById(doc._id).populate('parent', 'name slug').lean();
    res.status(201).json({ data: populated });
  } catch (e) {
    next(e);
  }
});
```

Central **error middleware** should send `{ message }` and set status from `e.status` or from Mongoose / validation errors.

---

## 7. CORS

If the Next.js site is on **another origin** than the API (e.g. `https://shop.example.com` calling `https://api.example.com`), enable **CORS** on Express for allowed origins and methods (`GET` for public; add `POST`, `PATCH`, `DELETE` for admin if needed).

If the frontend only calls **same-origin** `/api/*` on Next.js, CORS is not required for those calls.

---

## 8. Health and operations

- **`GET /health`** — return `{ ok: true }` for load balancers and uptime checks.
- **Logging** — log method, path, status, and a request id; avoid logging full PII or secrets.
- **Rate limiting** — apply on public or auth endpoints as needed.

---

## 9. How this repo relates to a separate backend

| Piece | Location |
|-------|----------|
| Storefront UI | Next.js `app/` |
| Admin UI | Next.js `app/admin/` |
| Admin CRUD API (current) | Next.js `app/api/admin/*` + `lib/db/` |
| Public read API (spec) | Documented in `docs/FRONTEND_API_INTEGRATION.md` (implement on Express or Next as you prefer) |

You can **move** admin mutations to Express later: point the admin UI `fetch` calls at the external base URL and mirror the same JSON shapes, or use Next.js Route Handlers as a **BFF** that proxies to Express.

---

## 10. Running and env (quick pointer)

For running the Next.js app, MongoDB URI, and admin UI locally, see **`docs/RUNNING_THE_PROJECT.md`**.
