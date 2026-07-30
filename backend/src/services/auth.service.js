/**
 * @fileoverview Authentication service.
 * Handles user registration, login, token management, and profile operations.
 * @module services/auth.service
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/database.js';
import emailService from './email.service.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

/** Number of bcrypt salt rounds for password hashing. */
const SALT_ROUNDS = 12;

/**
 * @class AuthService
 * @description Provides authentication and user management operations.
 */
class AuthService {
  /**
   * Registers a new user account.
   */
  async register(name, email, password, phoneNumber = null, address = null) {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const error = new Error('An account with this email already exists.');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        phoneNumber,
        address
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        address: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send Welcome Email
    emailService.sendWelcome(user).catch(err => console.error('Welcome email failed:', err.message));

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, jti: crypto.randomUUID() });

    await this._storeRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  }

  /**
   * Authenticates a user with email and password.
   */
  async login(email, password) {
    console.log(`🔑 Login attempt for: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log('❌ User not found in database');
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive) {
      console.log('❌ User account is inactive');
      const error = new Error('Your account has been deactivated. Contact support.');
      error.statusCode = 403;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log('❌ Invalid password provided');
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    console.log('✅ Login successful');
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, jti: crypto.randomUUID() });

    await this._storeRefreshToken(user.id, refreshToken);

    const {
      passwordHash: _,
      resetPasswordToken: __,
      resetPasswordExpires: ___,
      ...userWithoutSensitiveData
    } = user;

    return { user: userWithoutSensitiveData, accessToken, refreshToken };
  }

  /**
   * Generates a password reset token and sends it via email.
   */
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    await emailService.sendPasswordReset(user, resetToken);
  }

  /**
   * Resets the user's password using a valid reset token.
   */
  async resetPassword(token, newPassword) {
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      const error = new Error('Password reset token is invalid or has expired.');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
  }

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required.');
      error.statusCode = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token.');
      error.statusCode = 401;
      throw error;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      if (storedToken) await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      const error = new Error('Invalid or expired refresh token.');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = generateAccessToken({
      userId: decoded.userId,
      role: storedToken.user.role,
    });

    return { accessToken };
  }

  async logout(refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phoneNumber: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  async updateProfile(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        avatarUrl: data.avatarUrl,
        address: data.address,
        phoneNumber: data.phoneNumber
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phoneNumber: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(userId, oldPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      const error = new Error('Current password is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  async _storeRefreshToken(userId, token) {
    const decoded = verifyRefreshToken(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await prisma.refreshToken.upsert({
      where: { token },
      update: { expiresAt },
      create: {
        token,
        userId,
        expiresAt,
      },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });
  }
}

export default new AuthService();
