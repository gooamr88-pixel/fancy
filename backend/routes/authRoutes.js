const express = require('express');
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

// Register new organizer: POST /api/v1/auth/register
router.post('/register', register);

// Login organizer: POST /api/v1/auth/login
router.post('/login', login);

// Forgot password link trigger: POST /api/v1/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// Reset password with OTP code: POST /api/v1/auth/reset-password
router.post('/reset-password', resetPassword);

module.exports = router;
