import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleGuard.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/stats - Overview statistics
 */
router.get('/stats', dashboardController.getStats);

/**
 * GET /api/dashboard/charts - Chart data
 */
router.get('/charts', dashboardController.getCharts);

/**
 * GET /api/dashboard/agent-performance - Agent performance metrics
 */
router.get(
  '/agent-performance',
  authorize('ADMIN'),
  dashboardController.getAgentPerformance
);

export default router;
