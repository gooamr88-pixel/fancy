const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// Register new organizer (creates unverified account + sends OTP): POST /api/v1/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Your name is required'),
  body('orgName').trim().notEmpty().isLength({ max: 200 }).withMessage('Organization name is required (max 200 chars)'),
  validate
], authController.register);

// Verify registration OTP (activates account + issues auth cookie): POST /api/v1/auth/verify-registration
router.post('/verify-registration', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  validate
], authController.verifyRegistration);

// Login organizer (issues auth cookie): POST /api/v1/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], authController.login);

// Logout (clears auth cookie): POST /api/v1/auth/logout
router.post('/logout', authController.logout);

// Google OAuth (unified — logs in existing users, creates new ones): POST /api/v1/auth/google
router.post('/google', [
  body('credential').notEmpty().withMessage('Google credential is required'),
  validate
], authController.googleAuth);

// Forgot password link trigger: POST /api/v1/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  validate
], authController.forgotPassword);

// Reset password with OTP code: POST /api/v1/auth/reset-password
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').notEmpty().withMessage('Confirm password is required'),
  validate
], authController.resetPassword);

// Get authenticated user's profile: GET /api/v1/auth/profile
router.get('/profile', requireAuth, authController.getProfile);

// Update authenticated user's profile: PATCH /api/v1/auth/profile
router.patch('/profile', [
  requireAuth,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
  validate
], authController.updateProfile);

// Change password (requires current password): POST /api/v1/auth/change-password
router.post('/change-password', [
  requireAuth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validate
], authController.changePassword);

module.exports = router;
