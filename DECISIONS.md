# Technical Decisions

This document explains why we chose certain approaches and the tradeoffs we accepted.

---

### 1. In-memory storage (Map objects)
*   **Decision:** We used simple JavaScript `Map` classes (`CartStore`, `OrderStore`, `DiscountStore`) instead of SQLite, PostgreSQL, or Mongo.
*   **Why:** For an interview project, setting up a database (even SQLite) adds installation and config steps for the reviewer. In-memory stores kept the code clean, dependencies minimal, and testing fast.
*   **Tradeoff:** All data resets when the server restarts. We designed the store interfaces so they can be replaced with database queries later without touching the service layer.

---

### 2. Manual Dependency Injection
*   **Decision:** We pass store instances to service constructors, and service instances to controller constructors, inside the route files (e.g., `checkout.routes.ts`).
*   **Why:** It avoids global state and lets us pass clean mock stores in unit tests. Using a DI library (like InversifyJS) would add too much boilerplate.
*   **Tradeoff:** We have to write the instantiation boilerplate manually in the route files. If a constructor signature changes, we must update the routes file.

---

### 3. Folder structure by feature (Vertical Slices)
*   **Decision:** Files are grouped under `src/modules/` by feature (like `cart/`, `checkout/`, `discount/`) containing their own routes, services, and tests.
*   **Why:** Colocating related files makes it easier to work on a feature. It is also easier to extract a feature into a separate service later if the project grows.
*   **Tradeoff:** It requires more folders upfront compared to standard `controllers/`, `services/`, `models/` layouts.

---

### 4. Custom validation middleware
*   **Decision:** We built a small `validate()` helper instead of using validation libraries like Zod or Joi.
*   **Why:** The API has very few fields. Adding a validation library adds bundle size and third-party dependencies for validation rules that are easily checked with simple JS helper functions.
*   **Tradeoff:** We don't get schema-based TypeScript type inference. If request bodies become nested or complex, we will need to migrate to Zod.

---

### 5. Checkout step order
*   **Decision:** In the checkout flow, we save the order first, and only mark the discount code as used if that succeeds.
*   **Why:** If we marked the discount code as used first and the order creation crashed, the customer would lose their coupon without their order going through.
*   **Tradeoff:** Because Node.js is single-threaded, we don't face concurrent double-spend race conditions in this demo. In a multi-server setup, we would need to wrap both writes in a database transaction.
