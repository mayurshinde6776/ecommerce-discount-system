import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { errorHandler, notFoundHandler } from './middlewares';
import { healthRouter } from './modules/health';
import { cartRouter } from './modules/cart';
import { checkoutRouter } from './modules/checkout';
import { adminRouter } from './modules/admin';

/**
 * Factory function that creates and configures the Express application.
 * Separating app creation from server startup makes it easy to import
 * the app in tests without binding to a port.
 */
export const createApp = (): Application => {
  const app = express();

  // ─── Security & Parsing ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Logging ───────────────────────────────────────────────────────────────
  const morganFormat = config.env === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat));

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/checkout', checkoutRouter);
  app.use('/admin', adminRouter);

  // TODO: Register domain routers here as they are implemented
  // app.use('/api/v1/discounts', discountRouter);
  // app.use('/api/v1/orders', orderRouter);

  // ─── Error Handling ────────────────────────────────────────────────────────
  // notFoundHandler must come AFTER all routes
  app.use(notFoundHandler);
  // errorHandler must come LAST and have exactly 4 parameters
  app.use(errorHandler);

  return app;
};
