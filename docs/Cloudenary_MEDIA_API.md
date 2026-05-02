# Media & Cloudinary API

Base URL for local development (set `PORT` in `.env`; defaults to **3000** if unset — your example uses **5000**):

**`http://localhost:5000`**

Replace the host/port when you deploy.

---

## Core API links

| Action | Method | Link |
|--------|--------|------|
| Health check | GET | [http://localhost:5000/health](http://localhost:5000/health) |
| **Create** upload (multipart `file`) | POST | [http://localhost:5000/api/media](http://localhost:5000/api/media) |
| **List** uploads | GET | [http://localhost:5000/api/media](http://localhost:5000/api/media) |
| **Read** one upload by MongoDB id | GET | `http://localhost:5000/api/media/{id}` — e.g. [http://localhost:5000/api/media/000000000000000000000000](http://localhost:5000/api/media/000000000000000000000000) *(replace with a real `_id`)* |
| **Update** metadata / links (JSON body) | PATCH | `http://localhost:5000/api/media/{id}` |
| **Replace** image file (multipart `file`) | POST | `http://localhost:5000/api/media/{id}/replace` — e.g. [http://localhost:5000/api/media/000000000000000000000000/replace](http://localhost:5000/api/media/000000000000000000000000/replace) |
| **Delete** upload + Cloudinary asset | DELETE | `http://localhost:5000/api/media/{id}` |

---

## List / filter query links (GET)

All are under [http://localhost:5000/api/media](http://localhost:5000/api/media):

- [?kind=category](http://localhost:5000/api/media?kind=category)
- [?kind=product](http://localhost:5000/api/media?kind=product)
- [?kind=general](http://localhost:5000/api/media?kind=general)
- [?page=1&limit=20](http://localhost:5000/api/media?page=1&limit=20)
- [?category=CATEGORY_OBJECT_ID](http://localhost:5000/api/media?category=CATEGORY_OBJECT_ID) *(replace with real id)*
- [?product=PRODUCT_OBJECT_ID](http://localhost:5000/api/media?product=PRODUCT_OBJECT_ID) *(replace with real id)*

You can combine query params, e.g.  
[http://localhost:5000/api/media?kind=product&page=1&limit=10](http://localhost:5000/api/media?kind=product&page=1&limit=10)

---

## Related REST routes (categories & products)

| Resource | Method | Link |
|----------|--------|------|
| List categories | GET | [http://localhost:5000/api/categories](http://localhost:5000/api/categories) |
| Category by slug | GET | `http://localhost:5000/api/categories/{slug}` — e.g. [http://localhost:5000/api/categories/pipes](http://localhost:5000/api/categories/pipes) |
| List products | GET | [http://localhost:5000/api/products](http://localhost:5000/api/products) |
| Product by SKU or slug | GET | `http://localhost:5000/api/products/{identifier}` — e.g. [http://localhost:5000/api/products/SAMPLE-SKU](http://localhost:5000/api/products/SAMPLE-SKU) |

---

## Cloudinary & dashboard

- [Cloudinary Console (dashboard)](https://console.cloudinary.com/)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- Delivered images use URLs like: `https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<folder>/<public_id>.<ext>`  
  Example cloud from this project’s docs: [https://res.cloudinary.com/dcy4lfsjm/](https://res.cloudinary.com/dcy4lfsjm/)

---

## Environment (reference)

- `CLOUDINARY_URL` — `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PREFIX` — default folder prefix (e.g. `rajasthan-pipe-traders` → uploads under `.../categories`, `.../products`, `.../general`)

See [`.env.example`](../.env.example) for placeholders.

---

## Quick request notes

- **POST** `/api/media`: `multipart/form-data`, field name **`file`**. Optional: `kind`, `caption`, **`categoryId` OR `productId`** (not both).
- **PATCH** `/api/media/:id`: JSON, e.g. `caption`, `categoryId` / `productId` (string or `null` to unlink).
- **POST** `/api/media/:id/replace`: multipart, field **`file`**.
- Max image size **12 MB**; only `image/*` types.
