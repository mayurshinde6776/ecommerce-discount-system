# E-Commerce Discount System

A production-structured REST API built with **Express** and **TypeScript** that manages shopping carts, checkout, discount codes, and loyalty rewards. Built as an interview assignment demonstrating clean architecture, service-layer separation, and comprehensive test coverage.

---

## Table of Contents

- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Architecture Overview](#architecture-overview)
- [Business Rules](#business-rules)
- [Testing](#testing)
- [Assumptions](#assumptions)
- [Project Structure](#project-structure)

---

## Setup Instructions

**Prerequisites:** Node.js ≥ 18, npm ≥ 9

```bash
# 1. Clone the repository
git clone <repo-url>
cd ecommerce-discount-system

# 2. Install dependencies
npm install

# 3. Start the development server (with hot-reload)
npm run dev
```

The server starts at **`http://localhost:3000`** by default.

---

## Environment Variables

Create a `.env` file in the project root (optional — defaults work out of the box):

```env
PORT=3000
NODE_ENV=development
APP_NAME=ecommerce-discount-system
APP_VERSION=1.0.0
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled production build |
| `npm test` | Run all tests (Jest, serial) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format all source files with Prettier |
| `npm run format:check` | Check formatting without writing |

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check — returns uptime, version, timestamp |

---

### Cart

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/cart/items` | Add (or merge) an item into the user's cart |
| `GET` | `/api/v1/cart/:userId` | Retrieve the active cart with computed totals |

#### `POST /api/v1/cart/items`

```json
// Request body
{
  "userId": "user-1",
  "productId": "prod-001",
  "name": "Blue T-Shirt",
  "price": 29.99,
  "quantity": 2
}

// Response 200
{
  "success": true,
  "data": {
    "id": "cart-uuid",
    "userId": "user-1",
    "items": [
      { "productId": "prod-001", "name": "Blue T-Shirt", "price": 29.99, "quantity": 2, "lineTotal": 59.98 }
    ],
    "itemCount": 2,
    "subtotal": 59.98
  }
}
```

**Validations:** `userId`, `productId`, `name` are required strings. `price` must be a positive number. `quantity` must be a positive integer.  
**Behaviour:** If the cart already contains the same `productId`, quantities are merged rather than duplicating the line item.

---

### Checkout

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/checkout` | Checkout the user's active cart |

#### `POST /api/v1/checkout`

```json
// Request body
{
  "userId": "user-1",
  "discountCode": "SAVE10"   // optional
}

// Response 201
{
  "success": true,
  "data": {
    "order": {
      "id": "order-uuid",
      "userId": "user-1",
      "status": "CONFIRMED",
      "items": [ { "productId": "prod-001", "name": "Blue T-Shirt", "price": 29.99, "quantity": 2, "lineTotal": 59.98 } ],
      "itemCount": 2,
      "subtotal": 59.98,
      "discount": 6.00,
      "discountCode": "SAVE10",
      "total": 53.98,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "loyaltyCoupon": {          // present only on the 5th, 10th, 15th... order
      "code": "LOYALTY5-SWIFTACE-042",
      "percentage": 10,
      "message": "🎉 You earned a 10% loyalty coupon for your next order!"
    }
  }
}
```

**Checkout flow (in order):**
1. Validate `userId` and resolve user's cart → 404 if missing
2. Guard empty cart → 400
3. Compute subtotal from cart items
4. Validate discount code (read-only) → 400 if invalid
5. Compute discount amount and final total
6. Create order record (status: `CONFIRMED`)
7. Mark discount code as used *(only after order is safely persisted)*
8. Clear cart items
9. Check loyalty threshold → mint 10% coupon if this is the 5th/10th/… confirmed order
10. Return order summary + optional loyalty coupon

---

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/admin/discount/generate` | Manually generate a discount code |
| `GET` | `/admin/stats` | Platform-wide statistics |

#### `POST /admin/discount/generate`

```json
// Request body
{ "percentage": 25, "prefix": "FLASH" }

// Response 201
{
  "success": true,
  "data": {
    "discountCode": {
      "code": "FLASH-BOLDKEY-037",
      "percentage": 25,
      "isActive": true,
      "isUsed": false,
      "createdAt": "..."
    }
  }
}
```

`prefix` is optional (defaults to `ADMIN`). `percentage` must be between 1 and 100.

#### `GET /admin/stats`

```json
// Response 200
{
  "success": true,
  "data": {
    "orders":  { "total": 12, "confirmed": 10, "pending": 1, "cancelled": 1 },
    "revenue": { "totalRevenue": 1840.00, "grossRevenue": 2000.00, "totalDiscountGiven": 160.00 },
    "items":   { "totalItemsSold": 34, "totalLineItems": 22 },
    "coupons": { "totalGenerated": 6, "available": 3, "used": 2, "inactive": 1 }
  }
}
```

> **Note:** All revenue and item metrics count only `CONFIRMED` orders.

---

### Error Response Shape

All error responses follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "message": "Cart not found for user \"user-1\"",
    "statusCode": 404
  }
}
```

| Status | Meaning |
|---|---|
| `400` | Validation error or invalid business input |
| `404` | Resource not found |
| `500` | Unexpected server error |

---

## Architecture Overview

```
src/
├── app.ts                  ← Express app factory (used by server + tests)
├── server.ts               ← Entry point — binds to port
├── config/                 ← Environment configuration
├── errors/                 ← AppError hierarchy (BadRequestError, NotFoundError, …)
├── middlewares/            ← errorHandler, notFoundHandler, validate factory
├── types/                  ← Shared response envelope types
└── modules/
    ├── health/             ← GET /health
    ├── cart/               ← Cart model, store, service, controller, routes, DTOs
    ├── checkout/           ← Checkout orchestration (cart + order + discount)
    ├── discount/           ← Discount model, store, service, code generator
    ├── order/              ← Order model, store
    └── admin/              ← Admin stats and manual code generation
```

### Layer responsibilities

```
Request → Route → [validate middleware] → Controller → Service → Store
                                                          ↑
                                               (all business logic here)
```

| Layer | Role |
|---|---|
| **Store** | In-memory `Map`-backed persistence with typed CRUD methods |
| **Service** | All business rules — validation, calculation, orchestration |
| **Controller** | Thin HTTP adapter — parse request, call service, wrap in envelope |
| **Route** | Wire URL + method to controller, attach route-level validation |
| **Middleware** | Cross-cutting concerns: error handling, 404, request validation |

### Key design decisions

- **`createApp()` factory** — separates app construction from port binding so integration tests import the app without opening a socket
- **Singleton stores + isolated test instances** — singletons used at runtime; every unit test creates fresh `new Store()` instances to avoid shared state
- **Validation is two-layered** — route middleware catches shape/type errors; service layer enforces business rules (price > 0, quantity is integer, etc.)
- **Discount redeemed after order persisted** — the code is only marked `isUsed` after the order record exists, minimising the inconsistency window
- **Secondary index on OrderStore** — `userId → Set<orderId>` map makes per-user order lookups O(k) instead of O(n)

---

## Business Rules

### Discount Codes
- A code is redeemable only when: it **exists**, `isActive === true`, and `isUsed === false`
- Validation is **case-insensitive** — `save10`, `SAVE10`, `Save10` all match
- Codes are **single-use** — once redeemed they are permanently marked `isUsed`
- `percentage` must be between 1 and 100 (inclusive)

### Loyalty Coupons
- Every **5th confirmed order** per user earns a **10% discount coupon**
- Thresholds: 5th, 10th, 15th, 20th … orders
- Only `CONFIRMED` orders count — `PENDING` and `CANCELLED` orders are excluded
- Loyalty coupons are prefixed `LOYALTY{n}-` (e.g. `LOYALTY5-SWIFTACE-042`)
- The coupon is included in the checkout response and is immediately usable

### Checkout Calculations
```
subtotal = Σ (item.price × item.quantity)
discount = subtotal × (code.percentage / 100)   // 0 if no code
total    = subtotal − discount
```
All monetary values are rounded to **2 decimal places**.

### Seed Data
Two discount codes are pre-loaded on startup for testing convenience:

| Code | Discount |
|---|---|
| `SAVE10` | 10% |
| `WELCOME20` | 20% |

---

## Testing

```bash
# Run all tests
npm test

# Run a specific test file
npx jest --testPathPattern="checkout.service"

# Run with coverage
npm run test:coverage

# Watch mode (re-runs on file change)
npm run test:watch
```

### Test suite breakdown

| Suite | File | Type | Tests |
|---|---|---|---|
| AppError hierarchy | `errors/__tests__/AppError.test.ts` | Unit | 5 |
| CartStore | `cart/__tests__/cart.store.test.ts` | Unit | 8 |
| CartService | `cart/__tests__/cart.service.test.ts` | Unit | 10 |
| Cart API | `cart/__tests__/cart.integration.test.ts` | Integration | 11 |
| DiscountStore | `discount/__tests__/discount.store.test.ts` | Unit | 9 |
| DiscountService | `discount/__tests__/discount.service.test.ts` | Unit | 25 |
| Code generator | `discount/__tests__/discount.codegen.test.ts` | Unit | 5 |
| OrderStore | `order/__tests__/order.store.test.ts` | Unit | 6 |
| CheckoutService | `checkout/__tests__/checkout.service.test.ts` | Unit | 15 |
| Checkout API | `checkout/__tests__/checkout.integration.test.ts` | Integration | 12 |
| AdminService | `admin/__tests__/admin.service.test.ts` | Unit | 17 |
| Admin API | `admin/__tests__/admin.integration.test.ts` | Integration | 12 |
| Health API | `health/__tests__/health.test.ts` | Integration | 4 |
| **Business Logic Spec** | `__tests__/business-logic.test.ts` | Unit | **34** |
| **Total** | | | **171** |

### Test philosophy

- **Unit tests** use isolated `new Store()` instances — no shared state between tests
- **Integration tests** use `supertest` against `createApp()` — no port binding
- **Business logic spec** (`business-logic.test.ts`) is organised by *domain rule*, not by class — each `describe` block reads like a product requirement with rule IDs (`RULE-DV-01`, `RULE-NO-03`, etc.)

---

## Assumptions

1. **No authentication** — `userId` is a plain string passed in the request body. In production, this would be derived from a JWT or session.

2. **In-memory storage** — all data is held in `Map` objects and resets on server restart. No database layer was added as this is a backend logic assignment.

3. **Single active cart per user** — if a user somehow accumulates multiple carts, the most recently updated one is used.

4. **Order status is immediately CONFIRMED** — in a real system, orders would go through `PENDING → payment processing → CONFIRMED`. For this assignment, checkout confirms immediately.

5. **No payment processing** — checkout creates and confirms the order without any payment gateway integration.

6. **Loyalty coupon minting is best-effort** — in rare code-collision scenarios, the generator retries up to 5 times. Failures surface as a 500 (server error) rather than silently skipping the reward.

7. **Admin endpoints are unauthenticated** — in production these would be behind admin auth middleware.

8. **Floating point rounding** — all monetary values are rounded to 2 decimal places using `toFixed(2)` + `parseFloat`. For a production system, a fixed-point arithmetic library (e.g. `decimal.js`) would be preferred.

9. **Seed data** — `SAVE10` and `WELCOME20` discount codes are seeded on startup for easy manual testing. Remove `discountStore.create(...)` calls in `discount.store.ts` for a clean slate.

---

## Project Structure

```
ecommerce-discount-system/
├── src/
│   ├── __tests__/
│   │   └── business-logic.test.ts   ← Domain rule spec tests
│   ├── app.ts                        ← Express factory
│   ├── server.ts                     ← Entry point
│   ├── config/
│   │   └── index.ts                  ← Env config
│   ├── errors/
│   │   ├── AppError.ts               ← Error hierarchy
│   │   └── __tests__/
│   ├── middlewares/
│   │   ├── errorHandler.ts
│   │   ├── notFoundHandler.ts
│   │   ├── validate.ts               ← Reusable validation middleware factory
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts                  ← ApiSuccessResponse, successResponse()
│   └── modules/
│       ├── health/
│       ├── cart/
│       │   ├── cart.model.ts
│       │   ├── cart.store.ts
│       │   ├── cart.service.ts
│       │   ├── cart.controller.ts
│       │   ├── cart.routes.ts
│       │   ├── cart.dto.ts
│       │   └── __tests__/
│       ├── checkout/
│       │   ├── checkout.service.ts   ← Orchestrates cart + order + discount
│       │   ├── checkout.controller.ts
│       │   ├── checkout.routes.ts
│       │   ├── checkout.dto.ts
│       │   └── __tests__/
│       ├── discount/
│       │   ├── discount.model.ts
│       │   ├── discount.store.ts
│       │   ├── discount.service.ts   ← validate / generate / mark-used / loyalty
│       │   ├── discount.codegen.ts   ← Human-readable code generator
│       │   └── __tests__/
│       ├── order/
│       │   ├── order.model.ts
│       │   ├── order.store.ts        ← Secondary index: userId → orderId[]
│       │   └── __tests__/
│       └── admin/
│           ├── admin.service.ts      ← Stats aggregation
│           ├── admin.controller.ts
│           ├── admin.routes.ts
│           ├── admin.dto.ts
│           └── __tests__/
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── tsconfig.json
└── package.json
```