const express = require('express');
const router = express.Router();
const historyController = require('../controllers/history.controller');
const verifyToken = require('../middlewares/verifyToken');
const { validateHistory } = require('../middlewares/validators');

router.use(verifyToken);

router.get('/', historyController.getHistory);
router.post('/', validateHistory, historyController.addHistory);
router.delete('/:id', historyController.deleteHistory);

module.exports = router;
