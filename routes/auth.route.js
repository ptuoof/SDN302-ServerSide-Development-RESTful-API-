const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const verifyToken = require('../middlewares/verifyToken');
const { validateRegister, validateLogin, validateProfile } = require('../middlewares/validators');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, validateProfile, authController.updateProfile);

module.exports = router;
