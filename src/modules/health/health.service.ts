import { config } from '../../config';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  app: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

/**
 * HealthService encapsulates system health checks.
 * Extend this to add DB ping, cache checks, etc.
 */
export class HealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      app: config.app.name,
      version: config.app.version,
      environment: config.env,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
