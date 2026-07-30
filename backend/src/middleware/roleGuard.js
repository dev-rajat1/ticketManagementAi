/**
 * @fileoverview Role-based access control middleware.
 * Restricts route access to users with specific roles.
 * Must be used after the authentication middleware (req.user must be set).
 * @module middleware/roleGuard
 */

import { errorResponse } from '../utils/apiResponse.js';

/**
 * Creates middleware that authorizes access based on user roles.
 *
 * @param {...string} roles - One or more allowed roles (e.g., 'ADMIN', 'AGENT', 'USER').
 * @returns {import('express').RequestHandler} Express middleware function.
 *
 * @example
 * // Only admins can access this route
 * router.get('/admin-only', authenticate, authorize('ADMIN'), controller);
 *
 * @example
 * // Admins and agents can access this route
 * router.get('/staff', authenticate, authorize('ADMIN', 'AGENT'), controller);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res,
        'Authentication required. Please log in first.',
        401
      );
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. This action requires one of the following roles: ${roles.join(', ')}.`,
        403
      );
    }

    next();
  };
};

export default authorize;
