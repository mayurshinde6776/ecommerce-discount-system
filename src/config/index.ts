import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  app: {
    name: process.env.APP_NAME ?? 'ecommerce-discount-system',
    version: process.env.APP_VERSION ?? '1.0.0',
  },
} as const;
