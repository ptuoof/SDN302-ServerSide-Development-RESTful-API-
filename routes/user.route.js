const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRole = require('../middlewares/authorizeRole');
const { validateSettings, validateAdminUserCreate, validateAdminUserUpdate } = require('../middlewares/validators');

router.use(verifyToken);

// ----- Signed-in user (declared before /:id) -----
router.get('/me/settings', userController.getMySettings);
router.put('/me/settings', validateSettings, userController.updateMySettings);
router.get('/me/data', userController.exportMyData);
router.post('/me/data/import', userController.importMyData);
router.delete('/me/data', userController.resetMyData);

// ----- Admin: user management -----
router.use(authorizeRole('admin'));
router.get('/', userController.listUsers);
router.post('/', validateAdminUserCreate, userController.createUser);
router.get('/:id', userController.getUser);
router.put('/:id', validateAdminUserUpdate, userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
