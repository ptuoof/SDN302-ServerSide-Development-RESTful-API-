const express = require('express');
const router = express.Router();
const mealPlanController = require('../controllers/mealPlan.controller');
const verifyToken = require('../middlewares/verifyToken');
const v = require('../middlewares/validators');

router.use(verifyToken);

router.get('/', v.validateMealQuery, mealPlanController.getEntries);
router.post('/', v.validateMealCreate, mealPlanController.createEntry);
// Static paths before /:id
router.post('/copy-day', v.validateMealCopyDay, mealPlanController.copyDay);
router.post('/to-shopping', v.validateMealRange, mealPlanController.addPlanToShopping);
router.patch('/:id', v.validateMealUpdate, mealPlanController.updateEntry);
router.delete('/:id', mealPlanController.deleteEntry);

module.exports = router;
