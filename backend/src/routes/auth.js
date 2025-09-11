const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateAuth } = require('../middleware/validation');
const authMiddleware = require('../middleware/authMiddleware');
const { rateLimiters } = require('../middleware/rateLimitMiddleware');

// @route   POST /api/v1/auth/register
// @desc    Start registration with email verification
// @access  Public
router.post('/register', rateLimiters.registration, validateAuth.register, authController.register);

// @route   POST /api/v1/auth/verify-registration
// @desc    Verify registration code and complete registration
// @access  Public
router.post('/verify-registration', rateLimiters.auth, validateAuth.verifyRegistration, authController.verifyRegistration);

// @route   POST /api/v1/auth/resend-code
// @desc    Resend verification code
// @access  Public
router.post('/resend-code', rateLimiters.auth, validateAuth.resendCode, authController.resendVerificationCode);

// @route   POST /api/v1/auth/check-tenant
// @desc    Check tenant for email (smart login)
// @access  Public
router.post('/check-tenant', rateLimiters.api, validateAuth.checkTenant, authController.checkTenant);

// @route   POST /api/v1/auth/check-subdomain
// @desc    Check if subdomain is available
// @access  Public
router.post('/check-subdomain', rateLimiters.api, validateAuth.checkSubdomain, authController.checkSubdomain);

// @route   POST /api/v1/auth/login
// @desc    Smart login - determine tenant from email
// @access  Public
router.post('/login', rateLimiters.auth, validateAuth.login, authController.login);

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', rateLimiters.api, authController.refresh);

// @route   POST /api/v1/auth/logout
// @desc    Logout user (invalidate refresh token)
// @access  Public
router.post('/logout', authController.logout);

// @route   POST /api/v1/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', rateLimiters.auth, validateAuth.forgotPassword, authController.forgotPassword);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', rateLimiters.auth, validateAuth.resetPassword, authController.resetPassword);

// @route   GET /api/v1/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authMiddleware, authController.getProfile);

// @route   PUT /api/v1/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, authController.updateProfile);

// @route   PUT /api/v1/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', authMiddleware, validateAuth.changePassword, authController.changePassword);

// @route   DELETE /api/v1/auth/account
// @desc    Delete account (owner only)
// @access  Private
router.delete('/account', authMiddleware, authController.deleteAccount);

// @route   GET /api/v1/auth/invitation/:token
// @desc    Get invitation details
// @access  Public
router.get('/invitation/:token', authController.getInvitation);

// @route   POST /api/v1/auth/accept-invitation
// @desc    Accept invitation and create account
// @access  Public
router.post('/accept-invitation', rateLimiters.registration, validateAuth.acceptInvitation, authController.acceptInvitation);

module.exports = router;