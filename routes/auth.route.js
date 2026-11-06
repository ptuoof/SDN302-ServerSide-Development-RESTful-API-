const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const verifyToken = require('../middlewares/verifyToken');
const v = require('../middlewares/validators');

// Account creation & sign-in
router.post('/register', v.validateRegister, authController.register);
router.post('/verify-email', v.validateVerifyEmail, authController.verifyEmail);
router.post('/resend-code', v.validateEmailOnly, authController.resendCode);
router.post('/login', v.validateLogin, authController.login);

// Password
router.post('/forgot-password', v.validateEmailOnly, authController.forgotPassword);
router.post('/reset-password', v.validateResetPassword, authController.resetPassword);
router.put('/change-password', verifyToken, v.validateChangePassword, authController.changePassword);

// Profile
router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, v.validateProfile, authController.updateProfile);

module.exports = router;
