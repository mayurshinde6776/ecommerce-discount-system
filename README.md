# E-Commerce Discount System

A clean, interview-quality Express + TypeScript backend built for scalability.

## Tech Stack

| Tool | Purpose |
|---|---|
| Express 4 | HTTP framework |
| TypeScript 5 (strict) | Type safety |
| ts-node-dev | Dev server with hot reload |
| ESLint + Prettier | Code quality & formatting |
| Jest + ts-jest + Supertest | Testing |
| Helmet / CORS / Morgan | Security & logging |

## Project Structure

```
src/
├── config/           # Typed env config (single source of truth)
├── errors/           # AppError hierarchy + unit tests
├── middlewares/      # errorHandler, notFoundHandler
├── modules/          # Feature modules (health, discount, …)
│   └── health/       # health.service → health.controller → health.routes
│       └── __tests__/
├── types/            # Shared TypeScript interfaces & response helpers
├── app.ts            # Express app factory (importable without port)
└── server.ts         # Entrypoint — binds port, graceful shutdown
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build
npm start
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with ts-node-dev (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Prettier format all source files |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Application health check |

### Health Response

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "app": "ecommerce-discount-system",
    "version": "1.0.0",
    "environment": "development",
    "uptime": 42,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Response Format

All errors follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "message": "Route GET /api/v1/unknown not found",
    "code": "OPTIONAL_ERROR_CODE"
  }
}
```

## Extending the Architecture

To add a new domain module (e.g., `discount`):

1. Create `src/modules/discount/`
2. Add files: `discount.model.ts` → `discount.store.ts` → `discount.service.ts` → `discount.controller.ts` → `discount.routes.ts` → `index.ts`
3. Register the router in `src/app.ts`
4. Add tests under `src/modules/discount/__tests__/`