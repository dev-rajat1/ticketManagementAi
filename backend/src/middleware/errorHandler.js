/**
 * @fileoverview Global error handler middleware.
 * Catches all unhandled errors and returns standardized API responses.
 * Handles specific error types from Prisma, JWT, and Multer.
 * @module middleware/errorHandler
 */

import { Prisma } from '@prisma/client';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Maps Prisma error codes to user-friendly messages.
 * @param {import('@prisma/client/runtime/library').PrismaClientKnownRequestError} error
 * @returns {{ statusCode: number, message: string }}
 */
const handlePrismaError = (error) => {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const fields = error.meta?.target;
      const fieldName = Array.isArray(fields) ? fields.join(', ') : fields || 'field';
      return {
        statusCode: 409,
        message: `A record with this ${fieldName} already exists.`,
      };
    }
    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: error.meta?.cause || 'The requested record was not found.',
      };
    case 'P2003':
      // Foreign key constraint failure
      return {
        statusCode: 400,
        message: 'Operation failed due to a related record constraint.',
      };
    case 'P2014':
      // Required relation violation
      return {
        statusCode: 400,
        message: 'The operation violates a required relation between records.',
      };
    default:
      return {
        statusCode: 500,
        message: process.env.NODE_ENV === 'development'
          ? `Database Error (${error.code}): ${error.message}`
          : 'A database error occurred.',
      };
  }
};

/**
 * Global error handler middleware.
 * Must be registered after all route handlers in the Express app.
 *
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} _next - Express next function (unused but required).
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Log errors in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error Details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // ─── Prisma Known Request Errors ──────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, message } = handlePrismaError(err);
    return errorResponse(res, message, statusCode);
  }

  // ─── Prisma Validation Errors ─────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(res, process.env.NODE_ENV === 'development' 
      ? `Prisma Validation Error: ${err.message}` 
      : 'Invalid data provided. Please check your input.', 400);
  }

  // ─── JWT Errors ───────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token has expired. Please refresh your token.', 401);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token. Please log in again.', 401);
  }

  if (err.name === 'NotBeforeError') {
    return errorResponse(res, 'Token is not yet active.', 401);
  }

  // ─── Multer Errors (File Upload) ──────────────────────
  if (err.name === 'MulterError') {
    const multerMessages = {
      LIMIT_FILE_SIZE: 'File size exceeds the allowed limit.',
      LIMIT_FILE_COUNT: 'Too many files uploaded.',
      LIMIT_FIELD_KEY: 'Field name is too long.',
      LIMIT_FIELD_VALUE: 'Field value is too long.',
      LIMIT_FIELD_COUNT: 'Too many fields.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
    };

    const message = multerMessages[err.code] || 'File upload error.';
    return errorResponse(res, message, 400);
  }

  // ─── Custom Application Errors ────────────────────────
  if (err.statusCode) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // ─── Syntax Errors (Malformed JSON) ───────────────────
  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, 'Malformed JSON in request body.', 400);
  }

  // ─── Default: Internal Server Error ───────────────────
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred. Please try again later.';

  return errorResponse(res, message, 500);
};

export default errorHandler;
