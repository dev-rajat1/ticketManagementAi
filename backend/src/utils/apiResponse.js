/**
 * @fileoverview Standardized API response helpers.
 * Ensures consistent response format: { success, message, data/errors, meta }
 * across all API endpoints.
 * @module utils/apiResponse
 */

/**
 * Sends a standardized success response.
 * @param {import('express').Response} res - Express response object.
 * @param {string} message - Human-readable success message.
 * @param {*} [data=null] - Response payload data.
 * @param {number} [statusCode=200] - HTTP status code.
 * @param {Object} [meta=null] - Optional metadata (pagination, counts, etc.).
 * @returns {import('express').Response} Express response.
 */
export const successResponse = (res, message, data = null, statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  if (meta !== null && meta !== undefined) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Sends a standardized error response.
 * @param {import('express').Response} res - Express response object.
 * @param {string} message - Human-readable error message.
 * @param {number} [statusCode=500] - HTTP status code.
 * @param {Array|Object} [errors=null] - Optional detailed error information.
 * @returns {import('express').Response} Express response.
 */
export const errorResponse = (res, message, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null && errors !== undefined) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
