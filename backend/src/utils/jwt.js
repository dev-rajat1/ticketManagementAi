/**
 * @fileoverview JWT utility functions for token generation and verification.
 * Supports separate access and refresh tokens with distinct secrets and expiry times.
 * @module utils/jwt
 */

import jwt from 'jsonwebtoken';

/**
 * Generates a short-lived access token.
 * @param {Object} payload - Data to encode in the token (e.g., { userId, role }).
 * @returns {string} Signed JWT access token.
 * @throws {Error} If JWT_ACCESS_SECRET is not configured.
 */
export const generateAccessToken = (payload) => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    // Increased default expiry from 15m to 1d for smoother development
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '1d',
  });
};

/**
 * Generates a long-lived refresh token.
 * @param {Object} payload - Data to encode in the token (e.g., { userId }).
 * @returns {string} Signed JWT refresh token.
 * @throws {Error} If JWT_REFRESH_SECRET is not configured.
 */
export const generateRefreshToken = (payload) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
};

/**
 * Verifies and decodes an access token.
 * @param {string} token - The JWT access token to verify.
 * @returns {Object} Decoded token payload.
 * @throws {jwt.TokenExpiredError} If the token has expired.
 * @throws {jwt.JsonWebTokenError} If the token is invalid.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * Verifies and decodes a refresh token.
 * @param {string} token - The JWT refresh token to verify.
 * @returns {Object} Decoded token payload.
 * @throws {jwt.TokenExpiredError} If the token has expired.
 * @throws {jwt.JsonWebTokenError} If the token is invalid.
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
