const express = require('express');
const router = express.Router();
const requestController = require('../controllers/request.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRole = require('../middlewares/authorizeRole');
const { validateRequestCreate, validateRequestUpdate } = require('../middlewares/validators');

router.use(verifyToken);

// Users
router.post('/', validateRequestCreate, requestController.createRequest);
router.get('/mine', requestController.getMyRequests);
router.delete('/:id', requestController.deleteRequest); // author or admin

// Admin review
router.get('/', authorizeRole('admin'), requestController.getAllRequests);
router.patch('/:id', authorizeRole('admin'), validateRequestUpdate, requestController.updateRequest);

module.exports = router;
