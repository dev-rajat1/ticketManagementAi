/**
 * @fileoverview Authentication controller.
 * Handles HTTP request/response for auth operations,
 * delegating business logic to AuthService.
 * @module controllers/auth.controller
 */

import authService from '../services/auth.service.js';
import { successResponse } from '../utils/apiResponse.js';

/**
 * Registers a new user.
 * @route POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phoneNumber, address } = req.body;
    const result = await authService.register(name, email, password, phoneNumber, address);

    return successResponse(res, 'Registration successful.', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticates a user and returns tokens.
 * @route POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return successResponse(res, 'Login successful.', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sends a password reset email.
 * @route POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);

    return successResponse(res, 'If an account exists with that email, a reset link has been sent.');
  } catch (error) {
    next(error);
  }
};

/**
 * Resets password using token.
 * @route POST /api/auth/reset-password/:token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    await authService.resetPassword(token, password);

    return successResponse(res, 'Password reset successful. You can now log in with your new password.');
  } catch (error) {
    next(error);
  }
};

/**
 * Refreshes an access token using a refresh token.
 * @route POST /api/auth/refresh
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken(token);

    return successResponse(res, 'Token refreshed successfully.', {
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logs out a user by revoking their refresh token.
 * @route POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    await authService.logout(token);

    return successResponse(res, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * Gets the authenticated user's profile.
 * @route GET /api/auth/me
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.id);

    return successResponse(res, 'Profile retrieved successfully.', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates the authenticated user's profile.
 * @route PUT /api/auth/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, avatarUrl, address, phoneNumber } = req.body;
    const user = await authService.updateProfile(req.user.id, { name, avatarUrl, address, phoneNumber });

    return successResponse(res, 'Profile updated successfully.', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * Changes the authenticated user's password.
 * @route PUT /api/auth/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, oldPassword, newPassword);

    return successResponse(res, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
};
