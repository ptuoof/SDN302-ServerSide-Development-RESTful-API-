const mongoose = require('mongoose');
const createError = require('http-errors');
const { CookHistory, Recipe } = require('../models');
const { formatHistory } = require('../utils/serializers');
const { canView } = require('../utils/recipeAccess');
const { HISTORY_LIMIT, HISTORY_NOTE_MAX } = require('../config/limits');

// @desc    My cooking history, newest first (optionally for one recipe)
// @route   GET /api/history?recipeId=
// @access  Private
exports.getHistory = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.recipeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.recipeId)) return next(createError(400, 'recipeId không hợp lệ'));
      filter.recipe = req.query.recipeId;
    }
    const entries = await CookHistory.find(filter).sort({ finishedAt: -1 }).limit(HISTORY_LIMIT);
    const history = entries.map(formatHistory);

    // { count, lastAt, avgRating } per recipe, like recipeStats() in the app
    const rated = history.filter(e => e.rating);
    res.status(200).json({
      success: true,
      count: history.length,
      history,
      ...(req.query.recipeId ? {
        stats: {
          count: history.length,
          lastAt: history[0]?.finishedAt || null,
          avgRating: rated.length ? Math.round(rated.reduce((s, e) => s + e.rating, 0) / rated.length * 10) / 10 : null
        }
      } : {})
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log a finished dish (with optional 1-5 rating and note). Keeps the newest 200 entries.
// @route   POST /api/history
// @access  Private
// @body    { recipeId, servings?, startedAt? (epoch ms), finishedAt? (epoch ms, default now), rating?, note? }
exports.addHistory = async (req, res, next) => {
  try {
    const { recipeId, servings, startedAt, finishedAt, rating, note } = req.body;
    const recipe = await Recipe.findById(recipeId).select('title servings author isPublic type');
    if (!recipe || !canView(recipe, req.user)) return next(createError(404, 'Không tìm thấy công thức'));

    const finished = Number(finishedAt) > 0 ? Number(finishedAt) : Date.now();
    const started = Number(startedAt);
    const entry = await CookHistory.create({
      user: req.user._id,
      recipe: recipe._id,
      recipeTitle: recipe.title,
      servings: Math.max(1, Math.round(Number(servings) || recipe.servings || 1)),
      startedAt: Number.isFinite(started) && started > 0 && started <= finished ? new Date(started) : null,
      finishedAt: new Date(finished),
      rating: rating == null ? null : Math.round(Number(rating)),
      note: String(note ?? '').trim().slice(0, HISTORY_NOTE_MAX)
    });

    // Keep only the newest HISTORY_LIMIT entries
    const overflow = await CookHistory.find({ user: req.user._id }).sort({ finishedAt: -1 }).skip(HISTORY_LIMIT).select('_id');
    if (overflow.length) await CookHistory.deleteMany({ _id: { $in: overflow.map(e => e._id) } });

    res.status(201).json({ success: true, entry: formatHistory(entry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete one history entry
// @route   DELETE /api/history/:id
// @access  Private
exports.deleteHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const removed = mongoose.Types.ObjectId.isValid(id) ? await CookHistory.findOneAndDelete({ _id: id, user: req.user._id }) : null;
    if (!removed) return next(createError(404, 'Không tìm thấy mục lịch sử'));
    res.status(200).json({ success: true, message: 'Đã xóa khỏi lịch sử nấu', deletedId: id });
  } catch (error) {
    next(error);
  }
};
