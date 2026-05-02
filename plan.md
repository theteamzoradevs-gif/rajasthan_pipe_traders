# 📋 COMPLETE BACKEND INTEGRATION PLAN
## Rajasthan Pipe Traders — Node.js + MongoDB Atlas

---

## 📊 CODEBASE ANALYSIS SUMMARY

### Current State
Your Next.js e-commerce application is **100% frontend-driven with hardcoded data**:

| Component | Status | Details |
|-----------|--------|---------|
| **Products** | 🔴 Hardcoded | 12 products in `app/data/products.ts` |
| **Categories** | 🔴 Hardcoded | 5 categories in `app/data/categories.ts` |
| **Search** | 🔴 Hardcoded | Static search index in `app/data/searchData.ts` |
| **Users** | 🔴 None | No authentication system |
| **Orders** | 🔴 Lost | No persistence (cleared on page refresh) |
| **Cart** | 🟡 Partial | In-memory only, no backend |
| **Wishlist** | 🟡 Partial | In-memory only, no persistence |
| **Database** | 🔴 None | No backend infrastructure |
| **APIs** | 🔴 None | No backend server |

---

## 🎯 THE PROBLEM & THE SOLUTION

### What's Currently Hardcoded (Everything Must Be Dynamic)

**Products Data** (12 items)
- Product names, descriptions, images
- Pricing (basic price + GST)
- Sizes (4MM to 100MM with variants like "20MM COMBO", "Oval Batten")
- Quantity info (qtyPerBag: pieces per shipping bag, pcsPerPacket: retail packet size)
- Multi-seller support (same product from 2-3 different sellers/brands)
- Discount tiers (7%, 8%, 9%, 12% based on carton quantity)
- Certifications, materials, tags

**Categories** (5 categories)
- Cable Clips
- Fasteners & Hardware
- Electrical Accessories
- Boxes & Plates
- Sanitaryware

**Sellers/Brands** (3 sellers)
- Hitech Square
- Tejas Craft
- N-Star

**Coupons** (4 hardcoded codes)
- `BULK7`: 7% on 15+ cartons
- `BULK9`: 9% on 50+ cartons
- `BULK12`: 12% on 85+ cartons
- `MIN25K`: Free on ₹25K+ (tracking only)

**Special Discounts**
- Electric tape: 2% only (hardcoded in product note)
- N-Star Ball Valves: 2% only (hardcoded in product note)

**Order Processing**
- Phone number collected → stored in localStorage → no backend submission
- Orders lost on page refresh
- No order history, tracking, or persistence

---

## 💼 TECHNOLOGY STACK RECOMMENDATION

```
Frontend:  Next.js 14+ (existing, stays the same)
Backend:   Node.js + Express.js + TypeScript
Database:  MongoDB Atlas (cloud-hosted, free tier available)
Auth:      JWT (access token + refresh token)
Storage:   AWS S3 or Cloudinary (images)
Validation: Joi or Zod (input validation)
Logging:   Winston or Morgan
Deployment: 
  - Backend: Heroku, Railway, Render, or AWS EC2
  - Frontend: Vercel (current)
  - Database: MongoDB Atlas (cloud)
```

---

## 🗄️ DATABASE SCHEMA DESIGN (9 Collections)

### 1. **Categories Collection**
```json
{
  "_id": ObjectId,
  "slug": "cable-clips",              // unique
  "name": "Cable Clips",
  "image": "https://s3.../image.jpg",
  "bgColor": "#FF5733",               // UI color
  "description": "Cable clips for...",
  "active": true,
  "createdAt": "2025-01-01",
  "updatedAt": "2025-01-01"
}
```

### 2. **Sellers Collection**
```json
{
  "_id": ObjectId,
  "name": "Hitech Square",            // unique
  "code": "HITECH",
  "email": "contact@hitech.com",
  "phone": "+91-9999999999",
  "gstNumber": "27AABCT1234H0Z0",
  "bankDetails": {
    "accountName": "Hitech Square",
    "accountNumber": "123456789",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India"
  },
  "active": true,
  "createdAt": "2025-01-01"
}
```

### 3. **Products Collection** (Most Important)
```json
{
  "_id": ObjectId,
  "slug": "cable-nail-clips",         // unique
  "name": "Single Cable Nail Clips",
  "brand": "Hitech Square",
  "brandCode": "HITECH / TEJAS",
  "categoryId": ObjectId,             // ref: Categories
  "subCategory": "Nail Cable Clips",
  "description": "Cable nail clips for secure...",
  "longDescription": "Cable nail clips from HiTech Square...",
  "features": ["High-grade virgin PP", "ISI Certified", "UV-stabilised"],
  
  "mainImage": "https://s3.../Cable_Clip.png",
  "images": ["https://s3.../Cable_Clip.png", "https://s3.../Nail_Cable_Clip.png"],
  
  "sizes": [
    {
      "size": "4MM",
      "basicPrice": 7.88,
      "withGST": 9.30,
      "qtyPerBag": 750,
      "pcsPerPacket": 100,
      "sku": "HITECH-4MM-001",
      "inventory": {
        "stock": 5000,
        "reorderLevel": 500,
        "maxStock": 10000
      }
    }
  ],
  
  "sellers": [
    {
      "sellerId": ObjectId,
      "sellerName": "Hitech Square",
      "prices": [
        { "size": "4MM", "basicPrice": 7.88, "withGST": 9.30 }
      ]
    }
  ],
  
  "discountTiers": [
    { "minQty": 15, "maxQty": 29, "discountPercent": 7 },
    { "minQty": 30, "maxQty": 49, "discountPercent": 8 },
    { "minQty": 50, "maxQty": 84, "discountPercent": 9 },
    { "minQty": 85, "maxQty": null, "discountPercent": 12 }
  ],
  
  "discountNote": null,
  "minOrder": "₹25,000 (Including GST)",
  "isNew": true,
  "isBestseller": true,
  "tags": ["cable-clip", "nail-clip", "wire-management"],
  "certifications": ["ISI Certified"],
  "material": "Virgin PP (Polypropylene)",
  "moq": null,
  "active": true,
  "createdAt": "2025-01-01",
  "updatedAt": "2025-01-01"
}
```

### 4. **Users Collection**
```json
{
  "_id": ObjectId,
  "email": "buyer@company.com",
  "password": "$2b$10$...",
  "phone": "+91-9876543210",
  "firstName": "Rajesh",
  "lastName": "Kumar",
  
  "address": {
    "street": "123 Commerce Street",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "country": "India"
  },
  
  "companyName": "ABC Traders",
  "gstNumber": "07AABCT1234H0Z0",
  "businessType": "wholesaler|retailer",
  
  "role": "customer|seller|admin",
  "isVerified": true,
  "preferredPaymentMethod": "bank_transfer|upi|cheque",
  
  "createdAt": "2025-01-01",
  "updatedAt": "2025-01-01"
}
```

### 5. **Orders Collection**
```json
{
  "_id": ObjectId,
  "orderId": "ORD-2025-001",
  "userId": ObjectId,
  
  "customerPhone": "+91-9876543210",
  "customerEmail": "buyer@company.com",
  "customerName": "Rajesh Kumar",
  
  "shippingAddress": {
    "street": "123 Commerce Street",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "country": "India"
  },
  
  "items": [
    {
      "productId": ObjectId,
      "productName": "Single Cable Nail Clips",
      "productSlug": "cable-nail-clips",
      "size": "4MM",
      "quantity": 30,
      "basicPricePerUnit": 7.88,
      "pricePerUnit": 9.30,
      "subtotal": 279,
      "sellerId": ObjectId,
      "sellerName": "Hitech Square"
    }
  ],
  
  "subtotal": 279,
  "basicTotal": 238.70,
  "gstAmount": 43.00,
  "discountAmount": 23.87,
  "couponCode": "BULK7",
  "couponDiscount": 16.71,
  "shippingCost": 0,
  "total": 298.42,
  
  "status": "pending|confirmed|shipped|delivered|cancelled",
  "paymentStatus": "pending|paid|failed",
  "paymentMethod": "bank_transfer|upi|cheque|credit_card",
  "paymentDetails": {
    "transactionId": "TXN123456",
    "paidAt": "2025-01-15"
  },
  
  "trackingNumber": "TR123456789",
  "estimatedDelivery": "2025-01-20",
  
  "timeline": {
    "createdAt": "2025-01-15T10:00:00Z",
    "confirmedAt": "2025-01-15T10:05:00Z",
    "shippedAt": "2025-01-16T14:30:00Z",
    "deliveredAt": "2025-01-18T09:15:00Z"
  },
  
  "notes": "Deliver after 6 PM",
  "internalNotes": "Bulk order from new customer"
}
```

### 6. **Coupons Collection**
```json
{
  "_id": ObjectId,
  "code": "BULK7",
  "name": "7% Bulk Order Discount",
  "description": "7% discount on 15+ cartons",
  "discountType": "percentage|fixed",
  "discountValue": 7,
  
  "conditions": {
    "minOrderValue": null,
    "minQuantity": 15,
    "maxQuantity": null,
    "applicableProducts": [],
    "applicableCategories": [],
    "excludeProducts": [ObjectId],
    "requiresGST": false
  },
  
  "validFrom": "2025-01-01",
  "validUntil": "2025-12-31",
  "usageLimit": null,
  "perUserLimit": 5,
  "usedCount": 142,
  
  "active": true,
  "createdAt": "2025-01-01",
  "updatedAt": "2025-01-01"
}
```

### 7. **Wishlist Collection**
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "productIds": [ObjectId, ObjectId],
  "createdAt": "2025-01-01",
  "updatedAt": "2025-01-01"
}
```

### 8. **Cart Collection** (Optional)
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "items": [
    {
      "productId": ObjectId,
      "productName": "Cable Nail Clips",
      "size": "4MM",
      "quantity": 30,
      "sellerId": ObjectId,
      "addedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "expiresAt": "2025-02-15",
  "createdAt": "2025-01-15",
  "updatedAt": "2025-01-15"
}
```

### 9. **Search Index Collection**
```json
{
  "_id": ObjectId,
  "productId": ObjectId,
  "name": "Cable Nail Clips",
  "category": "Cable Clips",
  "brand": "Hitech Square",
  "tags": ["cable-clip", "nail-clip"],
  "searchText": "Cable Nail Clips Hitech Square..."
}
```

---

## 🔌 API ROUTES & ENDPOINTS

### Base URL Structure
```
Development:  http://localhost:5000/api/v1
Production:   https://api.rajasthanpipetraders.com/api/v1
```

### 1️⃣ **Product Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/products` | No | List products with filters & pagination |
| GET | `/products/:slug` | No | Get single product |
| GET | `/products/:id/related` | No | Get related products from same category |
| POST | `/products` | Admin | Create new product |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Delete product |
| POST | `/products/upload-images` | Admin | Upload product images |

**GET `/api/v1/products` Example**
```
Query Parameters:
  ?category=cable-clips
  &brand=Hitech%20Square
  &minPrice=100
  &maxPrice=1000
  &sort=price_asc|price_desc|name|newest
  &search=cable
  &page=1
  &limit=20

Response:
{
  "success": true,
  "data": [
    { product object }, { product object }, ...
  ],
  "pagination": {
    "total": 342,
    "pages": 18,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

### 2️⃣ **Category Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/categories` | No | List all categories |
| GET | `/categories/:slug` | No | Get single category with product count |
| POST | `/categories` | Admin | Create category |
| PUT | `/categories/:id` | Admin | Update category |
| DELETE | `/categories/:id` | Admin | Delete category |

### 3️⃣ **Order Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/orders` | No | Create new order (validate, charge, save) |
| GET | `/orders/:orderId` | Auth | Get order details |
| GET | `/orders` | Auth | Get user's orders (paginated) |
| PUT | `/orders/:id/status` | Admin | Update order status/tracking |
| DELETE | `/orders/:id` | Admin | Cancel order |
| POST | `/orders/validate` | No | Validate order before checkout |
| GET | `/orders/status/:orderId` | No | Get order status (public tracking) |

**POST `/api/v1/orders` Example**
```json
Request Body:
{
  "customerPhone": "+91-9876543210",
  "customerEmail": "buyer@company.com",
  "customerName": "Rajesh Kumar",
  "shippingAddress": {
    "street": "123 Commerce Street",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001"
  },
  "items": [
    {
      "productId": "637c8f2d5b3c4e2f1a9e8c3d",
      "size": "4MM",
      "quantity": 30,
      "basicPricePerUnit": 7.88,
      "pricePerUnit": 9.30,
      "sellerId": "637c8f2d5b3c4e2f1a9e8c4e"
    }
  ],
  "couponCode": "BULK7",
  "paymentMethod": "bank_transfer",
  "notes": "Deliver after 6 PM"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "ORD-2025-001",
    "total": 298.42,
    "status": "pending",
    "paymentInstructions": {
      "bankName": "State Bank of India",
      "accountName": "Rajasthan Pipe Traders",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234"
    },
    "message": "Order created. Payment pending."
  }
}
```

### 4️⃣ **Authentication Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/auth/register` | No | Create user account |
| POST | `/auth/login` | No | Login, get JWT tokens |
| POST | `/auth/refresh` | No | Get new accessToken from refreshToken |
| POST | `/auth/logout` | Auth | Invalidate refresh token |
| POST | `/auth/forgot-password` | No | Send password reset email |
| POST | `/auth/reset-password` | No | Reset password with token |
| GET | `/auth/verify/:token` | No | Verify email address |

**POST `/auth/login` Example**
```json
Request:
{
  "email": "buyer@company.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1N...",
    "refreshToken": "eyJhbGciOiJIUzI1N...",
    "user": {
      "_id": "637c8f2d5b3c4e2f1a9e8c3d",
      "email": "buyer@company.com",
      "firstName": "Rajesh",
      "lastName": "Kumar",
      "phone": "+91-9876543210",
      "role": "customer"
    }
  }
}
```

### 5️⃣ **User Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/users/profile` | Auth | Get current user profile |
| PUT | `/users/profile` | Auth | Update profile |
| GET | `/users/orders` | Auth | Get user's order history |
| PUT | `/users/password` | Auth | Change password |
| DELETE | `/users/account` | Auth | Delete account |

### 6️⃣ **Coupon Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/coupons/validate` | No | Validate coupon code |
| POST | `/coupons` | Admin | Create coupon |
| GET | `/coupons` | Admin | List all coupons |
| PUT | `/coupons/:id` | Admin | Update coupon |
| DELETE | `/coupons/:id` | Admin | Delete coupon |

**GET `/coupons/validate?code=BULK7&orderTotal=500&items=15` Example**
```json
Response:
{
  "success": true,
  "data": {
    "code": "BULK7",
    "isValid": true,
    "discountType": "percentage",
    "discountValue": 7,
    "discountAmount": 35,
    "finalTotal": 465,
    "message": "Coupon applied successfully"
  }
}
```

### 7️⃣ **Wishlist Endpoints**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/wishlist` | Auth | Get user's wishlist with products |
| POST | `/wishlist` | Auth | Add product to wishlist |
| DELETE | `/wishlist/:productId` | Auth | Remove from wishlist |
| GET | `/wishlist/:productId` | Auth | Check if product is wishlisted |

---

## 🛠️ IMPLEMENTATION PHASES & TIMELINE

### Phase 1: Backend Infrastructure (Days 1-7)
- [ ] Node.js project setup with Express
- [ ] MongoDB Atlas cluster creation
- [ ] Environment configuration
- [ ] Middleware setup (CORS, JSON, error handling)
- [ ] Database connection
- [ ] Logging system

**Duration**: 7 days
**Deliverables**: Working backend server on port 5000

### Phase 2: Database & Models (Days 8-14)
- [ ] Create all 9 MongoDB collections
- [ ] Design indices for performance
- [ ] Implement Mongoose schemas
- [ ] Data validation rules
- [ ] Create seed script
- [ ] Migrate hardcoded data

**Duration**: 7 days
**Deliverables**: Seeded database with test data

### Phase 3: API Endpoints - Products & Categories (Days 15-24)
- [ ] Product listing with filters
- [ ] Product detail retrieval
- [ ] Category listing
- [ ] Search functionality
- [ ] Image upload handling

**Duration**: 10 days
**Deliverables**: All product/category endpoints tested

### Phase 4: Orders & Payment (Days 25-31)
- [ ] Order creation endpoint
- [ ] Order validation logic
- [ ] Order status tracking
- [ ] Coupon application logic
- [ ] Price calculation (GST, discounts)

**Duration**: 7 days
**Deliverables**: Complete order workflow

### Phase 5: Authentication & Users (Days 32-38)
- [ ] User registration and login
- [ ] JWT token generation
- [ ] Token refresh logic
- [ ] Password hashing (bcrypt)
- [ ] Email verification (optional)

**Duration**: 7 days
**Deliverables**: Secure authentication system

### Phase 6: Wishlist & Cart (Days 39-42)
- [ ] Wishlist CRUD operations
- [ ] Persistent cart (optional)
- [ ] Cart synchronization

**Duration**: 4 days
**Deliverables**: User preference persistence

### Phase 7: Frontend Integration (Days 43-50)
- [ ] Create API client utility
- [ ] Replace hardcoded data with API calls
- [ ] Add authentication UI
- [ ] Update components for dynamic data
- [ ] Error handling & loading states

**Duration**: 8 days
**Deliverables**: Frontend fully integrated with backend

### Phase 8: Testing & Deployment (Days 51-56)
- [ ] Unit tests for backend
- [ ] Integration tests
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deploy backend (Heroku/Railway/AWS)
- [ ] Deploy frontend updates

**Duration**: 6 days
**Deliverables**: Live production system

**Total Timeline**: 56 days (~8 weeks)

---

## 📝 COMPLETE MIGRATION CHECKLIST

### ✅ Backend Setup
- [ ] Create `rajasthan-backend` Node.js project
- [ ] Install dependencies: express, mongoose, bcryptjs, jsonwebtoken, multer, cors, dotenv
- [ ] Create `.env` file with secrets
- [ ] Setup folder structure (models, routes, controllers, middleware, utils)
- [ ] Configure Express server with middleware
- [ ] Setup CORS to allow frontend requests
- [ ] Create error handling middleware
- [ ] Setup logging (Winston or Morgan)
- [ ] Test server runs on port 5000

### ✅ Database Schema
- [ ] Create MongoDB Atlas account
- [ ] Create cluster (free tier or paid)
- [ ] Get connection string
- [ ] Define all 9 MongoDB collections
- [ ] Create Mongoose schemas for each collection
- [ ] Add indices for performance (slug, email, code, productId)
- [ ] Add validation rules (required fields, unique constraints)
- [ ] Test connection from backend

### ✅ Data Migration
- [ ] Transform `products.ts` → MongoDB Product documents (12 items → 12+ documents)
- [ ] Transform `categories.ts` → MongoDB Category documents (5 items)
- [ ] Transform `searchData.ts` → MongoDB Search Index
- [ ] Create Sellers collection with Hitech Square, Tejas Craft, N-Star
- [ ] Create default admin user
- [ ] Create default coupons (BULK7, BULK9, BULK12, MIN25K)
- [ ] Seed database with test data
- [ ] Verify data integrity

### ✅ API Implementation
- [ ] Implement all product endpoints (GET, POST, PUT, DELETE)
- [ ] Implement all category endpoints
- [ ] Implement all order endpoints
- [ ] Implement all auth endpoints
- [ ] Implement all user endpoints
- [ ] Implement coupon validation endpoint
- [ ] Implement wishlist endpoints
- [ ] Add request validation (Joi/Zod)
- [ ] Add error responses with proper status codes
- [ ] Test all endpoints with Postman/Insomnia

### ✅ Image Handling
- [ ] Choose storage solution (AWS S3 or Cloudinary)
- [ ] Configure image upload route
- [ ] Setup image upload middleware (multer)
- [ ] Test image uploads
- [ ] Update URLs in database

### ✅ Frontend Integration
- [ ] Create `lib/apiClient.ts` with all API methods
- [ ] Add token storage (localStorage) with getters/setters
- [ ] Create request interceptor for JWT headers
- [ ] Create token refresh logic for 401 responses
- [ ] Update `app/page.tsx` to fetch categories & products from API
- [ ] Update category page to fetch data from API
- [ ] Update product detail page to fetch from API
- [ ] Update component data sources one by one
- [ ] Update Cart & Order submission to use API
- [ ] Add loading states & error handling in components
- [ ] Test all data flows end-to-end

### ✅ Features
- [ ] User registration & login
- [ ] Add products to wishlist (requires auth)
- [ ] Add items to cart
- [ ] Apply coupon codes
- [ ] Submit orders with validation
- [ ] View order history (authenticated users)
- [ ] Update user profile
- [ ] Change password

### ✅ Testing
- [ ] Unit test backend controllers
- [ ] Integration test API endpoints
- [ ] Test authentication flow
- [ ] Test order validation
- [ ] Test coupon application
- [ ] End-to-end user journey tests
- [ ] Performance testing (response times)
- [ ] Load testing (concurrent users)

### ✅ Deployment
- [ ] Setup backend service on Heroku/Railway/AWS
- [ ] Configure environment variables
- [ ] Setup database backups
- [ ] Setup error monitoring (Sentry)
- [ ] Deploy backend
- [ ] Update frontend API base URL for production
- [ ] Deploy frontend to Vercel
- [ ] Monitor logs & performance
- [ ] Setup SSL/TLS certificates

---

## 🚀 DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                       PRODUCTION SETUP                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐    ┌──────────┐
│  Next.js Frontend│      │ Node.js Backend  │    │  MongoDB │
│  (Vercel)        │◄────►│ (Heroku/Railway) │───►│  Atlas   │
│  rajasthan..com  │      │ api.rajasthan... │    │ (Cloud)  │
└──────────────────┘      └──────────────────┘    └──────────┘
         │                         │
         │                         │
    React Components        REST API (JSON)
    Static Gen (SSG)        JWT Authentication
    Client-side Routing     Order Processing
         │                  Inventory Mgmt
         │                         │
         └─────────────────────────┘
              ↓
         Cloudinary/S3 (Images)
```

---

## 💡 KEY ARCHITECTURAL DECISIONS

| Decision | Rationale |
|----------|-----------|
| **MongoDB (NoSQL)** | Flexible schema, easy scaling, free tier, JSON-like docs match frontend data structures |
| **JWT Tokens** | Stateless auth, no server-side sessions, works with microservices |
| **Separate Backend URL** | Flexible scaling, independent deployment, can add multiple backends later |
| **Image CDN (S3/Cloudinary)** | Offload storage from MongoDB, faster downloads, cost-effective |
| **Express + TypeScript** | Familiar, minimal, type-safe, large ecosystem |
| **Vercel for Frontend** | Zero-config deployment, integrates with Next.js, free tier sufficient |
| **API Versioning** (`/api/v1/...`) | Future-proof, can migrate to v2 without breaking v1 clients |

---

## 🔐 SECURITY CHECKLIST

- [ ] **Passwords**: Bcrypt hashing (min 10 rounds)
- [ ] **JWT**: Access token expiry 1 hour, Refresh token 30 days
- [ ] **CORS**: Whitelist only your frontend domain
- [ ] **HTTPS**: Enforce SSL in production
- [ ] **API Keys**: All secrets in .env, never in code
- [ ] **Input Validation**: Server-side validation on all endpoints
- [ ] **Rate Limiting**: Max 100 requests/minute per IP (prevent brute force)
- [ ] **SQL Injection**: N/A (MongoDB), but validate object structure
- [ ] **Price Tampering**: Re-validate prices on backend (customer can't modify prices)
- [ ] **Admin Routes**: Require JWT + role check (`role === "admin"`)
- [ ] **Sensitive Data**: Hash GST numbers? No sensitive fields in error responses
- [ ] **CSRF Protection**: Use JWT headers instead of cookies
- [ ] **Data Backup**: MongoDB Atlas automated backups (daily)

---

## 📚 EXAMPLE CODE SNIPPETS

### Backend: Express Server Setup
```javascript
// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/orders', require('./routes/orders'));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/coupons', require('./routes/coupons'));
app.use('/api/v1/wishlist', require('./routes/wishlist'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### Frontend: API Client
```typescript
// lib/apiClient.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = {
  // Products
  async getProducts(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/products?${params}`);
    return response.json();
  },

  async getProductBySlug(slug: string) {
    const response = await fetch(`${API_BASE}/products/${slug}`);
    if (!response.ok) throw new Error('Product not found');
    return response.json();
  },

  // Orders
  async createOrder(orderData: any, token: string) {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });
    return response.json();
  },

  // Auth
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.data) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  }
};
```

### Backend: Database Seeding Script
```javascript
// scripts/seed.js
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Seller = require('../models/Seller');

async function seedDatabase() {
  try {
    // Create categories
    const categories = await Category.insertMany([
      { slug: 'cable-clips', name: 'Cable Clips', bgColor: '#FF5733' },
      { slug: 'fasteners', name: 'Fasteners & Hardware', bgColor: '#33FF57' },
      // ... more categories
    ]);

    // Create sellers
    const sellers = await Seller.insertMany([
      { name: 'Hitech Square', code: 'HITECH', email: '...' },
      { name: 'Tejas Craft', code: 'TEJAS', email: '...' },
      { name: 'N-Star', code: 'NSTAR', email: '...' }
    ]);

    // Create products
    const products = await Product.insertMany([
      {
        slug: 'cable-nail-clips',
        name: 'Single Cable Nail Clips',
        categoryId: categories[0]._id,
        // ... product data
      }
      // ... more products
    ]);

    console.log(`Seeded ${products.length} products`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
```

---

## 🎯 NEXT STEPS (In Order)

1. **Create Backend Project** → Initialize Express + MongoDB
2. **Design Database Schemas** → Finalize models & relationships
3. **Implement Models** → Mongoose schemas with validation
4. **Seed Database** → Migrate all hardcoded data
5. **Build Product APIs** → GET/POST/PUT/DELETE products
6. **Build Order APIs** → Order creation, validation, tracking
7. **Build Auth System** → JWT login, registration, token refresh
8. **Create Frontend Client** → API utility, token management
9. **Migrate Components** → Replace static data with API calls
10. **Test End-to-End** → Fix bugs, optimize performance
11. **Deploy** → Backend to Heroku/Railway, Frontend to Vercel
12. **Monitor & Support** → Logs, errors, user feedback

---

## 📞 SUPPORT STRUCTURE

```
┌─────────────────────────────────┐
│  Rajasthan Pipe Traders Support │
└─────────────────────────────────┘
          │
    ┌─────┴─────┬──────────┬──────────┐
    │           │          │          │
Tech Support  Orders  WhatsApp   Email
   Email     Backend   Popup     Support
               API
```

---

## ✨ FUTURE ENHANCEMENTS (Phase 2+)

- [ ] Payment gateway integration (Razorpay/Stripe)
- [ ] Email notifications (nodemailer/SendGrid)
- [ ] SMS tracking via Twilio
- [ ] Bulk product upload (CSV/Excel)
- [ ] Product reviews & ratings
- [ ] Advanced search with facets
- [ ] Seller dashboard
- [ ] Analytics & reporting
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Inventory management system
- [ ] Automated reorder system
- [ ] Customer loyalty program
- [ ] API rate limiting & throttling

---

## 📋 FINAL SUMMARY

Your **12-product static e-commerce site** needs to become a **fully dynamic B2B platform**. This requires:

1. **Backend Creation** — Node.js/Express server with REST APIs
2. **Database Design** — 9 MongoDB collections for all entities
3. **Data Migration** — Move hardcoded data to cloud database
4. **Frontend Integration** → Replace data imports with API calls
5. **Deployment** — Separate backend & frontend services

**Investment**: ~8 weeks of development
**Result**: Production-ready e-commerce platform with:
✅ Dynamic product catalog
✅ User authentication
✅ Order management & tracking
✅ Multi-seller support
✅ B2B pricing (GST, bulk discounts, multiple sizes)
✅ Persistent wishlists & order history
✅ Admin dashboard (future)

---

**🎉 Ready to start building? Begin with Phase 1: Backend Infrastructure Setup!**
