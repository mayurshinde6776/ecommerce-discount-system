import { Router } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const router = Router();

// Dependency wiring — swap with DI container when scaling
const healthService = new HealthService();
const healthController = new HealthController(healthService);

/**
 * @route   GET /health
 * @desc    Application health check
 * @access  Public
 */
router.get('/', healthController.getHealth);

export default router;
