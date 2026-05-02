# Running the Rajasthan Pipe Traders project

This repository is a **Next.js** storefront plus an **in-app admin** that reads and writes **categories** and **products** in **MongoDB** (via Mongoose).

---

## What you need installed

1. **Node.js** — version **20 LTS** or newer is a safe choice (match whatever your team standardizes on).
2. **npm** — comes with Node.
3. **MongoDB** — either:
   - **MongoDB Atlas** (cloud, free tier works), or  
   - **MongoDB Community** running locally (`mongodb://localhost:27017/...`).

You do **not** need a separate Express server for the admin CRUD that lives in this repo; it uses **Next.js Route Handlers** under `/api/admin/*`.

---

## 1. Get the code and install dependencies

```bash
cd rajasthan_pipe_traders
npm install
```

---

## 2. Environment variables

Create a file named **`.env.local`** in the **project root** (same folder as `package.json`). Next.js loads this automatically in development and production builds on your machine.

### Required for admin + `/api/admin/*`

| Variable        | Purpose |
|----------------|---------|
| `MONGODB_URI`  | Full MongoDB connection string (Atlas or local). |

Example (Atlas — replace user, password, cluster, and database name):

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/DATABASE_NAME?retryWrites=true&w=majority
```

Example (local):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/rajasthan_pipe_traders
```

**Security:** Never commit `.env.local` or real credentials. The repo should list only **`.env.example`** (no secrets) as a template.

### Optional

| Variable | Purpose |
|----------|---------|
| `PORT` | Used by some hosting setups. Next.js dev defaults to **3000**; you can run `next dev -p 3001` if 3000 is busy. |

---

## 3. Run the development server

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

| URL | What it is |
|-----|------------|
| `/` | Storefront (still uses static data under `app/data/` unless you wire pages to an API). |
| `/admin` | Admin home with links. |
| `/admin/categories` | CRUD for **categories** in MongoDB. |
| `/admin/products` | CRUD for **products** in MongoDB. |

If the dev server says the port is in use, start on another port:

```bash
npx next dev -p 3001
```

---

## 4. How the pieces fit together

1. **Browser** loads React pages from the Next.js app.
2. **Admin pages** call **`fetch('/api/admin/...')`** (same origin — no CORS setup needed for that).
3. **Route Handlers** in `app/api/admin/` call **`connectDb()`** and Mongoose models in `lib/db/models/`.
4. **MongoDB** stores documents shaped like `docs/Category.js` and `docs/Product.js` (schemas are mirrored in TypeScript in `lib/db/models/`).

Public API **shapes** for read-only endpoints are documented in **`docs/FRONTEND_API_INTEGRATION.md`** (that doc describes a typical Express API; this repo’s **write** paths are **`/api/admin/*`** only).

---

## 5. Production build (local test)

```bash
npm run build
npm run start
```

Then open **http://localhost:3000** again. For production hosting (e.g. Vercel), set **`MONGODB_URI`** in the host’s environment variables UI — **not** in the repo.

---

## 6. Common problems

| Symptom | What to check |
|---------|----------------|
| Admin shows errors about **`MONGODB_URI`** | `.env.local` exists at repo root, variable name is exact, server was **restarted** after editing env. |
| **Connection refused** (local Mongo) | `mongod` is running, URI host/port match. |
| **Authentication failed** (Atlas) | User/password, IP allowlist (**Network Access** → allow your IP or `0.0.0.0/0` for dev only), correct database user. |
| **Empty lists** | Database/collection names match where your data actually lives; you may need to seed data or create records from the admin UI. |
| Port **3000** busy | `npx next dev -p 3001` or stop the other process. |

---

## 7. Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |

---

## 8. Further reading

- **Public read API (for storefront integration):** `docs/FRONTEND_API_INTEGRATION.md`
- **Adding or extending backend HTTP APIs (Express-style):** `docs/BACKEND_API_GUIDE.md`
- **Mongoose schemas (reference):** `docs/Category.js`, `docs/Product.js`
