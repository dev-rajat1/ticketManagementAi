/**
 * @fileoverview Authentication routes.
 * Defines all auth-related endpoints with input validation
 * and authentication middleware where required.
 * @module routes/auth.routes
 */

import { Router } from 'express';
import { body } from 'express-validator';
import validateRequest from '../middleware/validate.js';
import authenticate from '../middleware/auth.js';
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

// ─── PUBLIC ROUTES ──────────────────────────────────────

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required.')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters.'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required.')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.'),
    body('phoneNumber')
      .optional()
      .trim(),
    body('address')
      .optional()
      .trim(),
  ],
  validateRequest,
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required.'),
  ],
  validateRequest,
  login
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset link
 * @access  Public
 */
router.post(
  '/forgot-password',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
  ],
  validateRequest,
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using a token
 * @access  Public
 */
router.post(
  '/reset-password/:token',
  [
    body('password')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.'),
  ],
  validateRequest,
  resetPassword
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required.'),
  ],
  validateRequest,
  refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke refresh token (logout)
 * @access  Public
 */
router.post(
  '/logout',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required.'),
  ],
  validateRequest,
  logout
);

// ─── PROTECTED ROUTES ───────────────────────────────────

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated user's profile
 * @access  Private
 */
router.get('/me', authenticate, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update authenticated user's profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters.'),
    body('avatarUrl')
      .optional()
      .trim(),
    body('address')
      .optional()
      .trim(),
    body('phoneNumber')
      .optional()
      .trim(),
  ],
  validateRequest,
  updateProfile
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change authenticated user's password
 * @access  Private
 */
router.put(
  '/change-password',
  authenticate,
  [
    body('oldPassword')
      .notEmpty()
      .withMessage('Current password is required.'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long.')
      .custom((value, { req }) => {
        if (value === req.body.oldPassword) {
          throw new Error('New password must be different from current password.');
        }
        return true;
      }),
  ],
  validateRequest,
  changePassword
);

export default router;
