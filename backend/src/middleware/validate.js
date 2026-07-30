/**
 * @fileoverview Request validation middleware using express-validator.
 * Checks the validation result and returns a 400 response with
 * formatted error details if any validation rules failed.
 * @module middleware/validate
 */

import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Middleware that checks for validation errors from express-validator chains.
 * Should be placed after validation chain middleware in the route definition.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next function.
 * @returns {void}
 *
 * @example
 * router.post('/register',
 *   body('email').isEmail(),
 *   body('password').isLength({ min: 6 }),
 *   validateRequest,
 *   controller.register
 * );
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return errorResponse(res, 'Validation failed', 400, formattedErrors);
  }

  next();
};

export default validateRequest;
