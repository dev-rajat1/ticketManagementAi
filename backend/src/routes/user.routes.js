import { Router } from 'express';
import { body, param } from 'express-validator';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleGuard.js';
import validateRequest from '../middleware/validate.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users - List all users
 * Use ?role=USER to list only customers
 */
router.get('/', authorize('ADMIN', 'AGENT'), userController.findAll);

/**
 * POST /api/users/bulk-delete - Bulk delete users (Admin only)
 */
router.post('/bulk-delete', authorize('ADMIN'), userController.bulkDelete);

/**
 * POST /api/users/customers - Create a new Customer
 * Forced to 'USER' role for security. Agents can use this.
 */
router.post(
  '/customers',
  authorize('ADMIN', 'AGENT'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phoneNumber').optional().trim(),
    body('address').optional().trim(),
    validateRequest,
  ],
  userController.createCustomer
);

/**
 * POST /api/users - General Create (Admin Only - for Staff/Agents)
 */
router.post(
  '/',
  authorize('ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['ADMIN', 'AGENT', 'USER']).withMessage('Invalid role'),
    validateRequest,
  ],
  userController.create
);

/**
 * GET /api/users/:id/customer-stats - Get Support History Stats
 */
router.get(
  '/:id/customer-stats',
  authorize('ADMIN', 'AGENT'),
  [param('id').isString().notEmpty().withMessage('Invalid user ID'), validateRequest],
  userController.getCustomerStats
);

/**
 * Standard Management Routes
 */
router.get('/:id', authorize('ADMIN', 'AGENT'), userController.findById);
router.put('/:id', authorize('ADMIN'), userController.update);
router.delete('/:id', authorize('ADMIN'), userController.remove);
router.patch('/:id/deactivate', authorize('ADMIN'), userController.deactivate);

export default router;
