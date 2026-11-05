const { User, Recipe, Category, RecipeRequest } = require('../models');
const { countByStatus } = require('./request.controller');

// @desc    Numbers for the admin overview screen
// @route   GET /api/admin/stats
// @access  Private (Admin)
exports.getStats = async (req, res, next) => {
  try {
    const [users, admins, locked, unverified, recipeRows, publicRecipes, categories, requests] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ locked: true }),
      User.countDocuments({ verified: false }),
      Recipe.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Recipe.countDocuments({ isPublic: true }),
      Category.countDocuments(),
      countByStatus({})
    ]);
    const byType = Object.fromEntries(['system', 'admin', 'personal'].map(type => [type, recipeRows.find(r => r._id === type)?.count || 0]));

    res.status(200).json({
      success: true,
      stats: {
        users: { users, admins, locked, unverified },
        recipes: { total: Object.values(byType).reduce((a, b) => a + b, 0), ...byType, public: publicRecipes },
        categories,
        requests: { ...requests, open: requests.pending + requests.in_progress, total: await RecipeRequest.countDocuments() }
      }
    });
  } catch (error) {
    next(error);
  }
};
