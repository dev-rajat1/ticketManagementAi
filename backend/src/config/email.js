/**
 * @fileoverview Nodemailer transporter configuration.
 * Uses SMTP credentials from environment variables to send emails.
 * @module config/email
 */

import nodemailer from 'nodemailer';

/**
 * Nodemailer SMTP transporter instance.
 * Configured using SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS env vars.
 * @type {import('nodemailer').Transporter}
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true for port 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Verifies the SMTP connection is working.
 * Logs a success message or warning on failure.
 * @returns {Promise<void>}
 */
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('📧 Email transporter is ready');
  } catch (error) {
    console.warn('⚠️  Email transporter verification failed:', error.message);
    console.warn('   Email functionality may not work. Check SMTP configuration.');
  }
};

export default transporter;
