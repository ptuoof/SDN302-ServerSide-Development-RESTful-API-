const mongoose = require('mongoose');
const createError = require('http-errors');
const { RecipeRequest, Recipe } = require('../models');
const { formatRequest } = require('../utils/serializers');
const { canView } = require('../utils/recipeAccess');
const L = require('../config/limits');

// Same rules as buildRequest() in the app (src/utils/recipeRequests.js)
const TYPE_LABELS = {
  new_recipe: 'Yêu cầu món mới',
  wrong_info: 'Sai thông tin',
  improve: 'Góp ý cải thiện',
  inappropriate: 'Nội dung không phù hợp'
};
const OPEN_STATUSES = ['pending', 'in_progress'];

const countByStatus = async filter => {
  const rows = await RecipeRequest.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  return Object.fromEntries(L.REQUEST_STATUSES.map(status => [status, rows.find(r => r._id === status)?.count || 0]));
};

const findRequestOr404 = async id => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy yêu cầu');
  const request = await RecipeRequest.findById(id);
  if (!request) throw createError(404, 'Không tìm thấy yêu cầu');
  return request;
};

// @desc    Send a recipe request or a report about a recipe
// @route   POST /api/requests
// @access  Private
// @body    { type: new_recipe|wrong_info|improve|inappropriate, title?, details, recipeId? (required except new_recipe) }
exports.createRequest = async (req, res, next) => {
  try {
    const { type } = req.body;
    const title = String(req.body.title ?? '').trim();
    const details = String(req.body.details ?? '').trim();
    const errors = [];

    let recipe = null;
    if (type !== 'new_recipe') {
      recipe = req.body.recipeId ? await Recipe.findById(req.body.recipeId).select('title author isPublic type') : null;
      if (!recipe || !canView(recipe, req.user)) errors.push('Chọn công thức cần báo cáo.');
    }
    if (type === 'new_recipe' && title.length < 2) errors.push('Nhập tên món bạn muốn có công thức.');
    if (title.length > L.REQUEST_TITLE_MAX) errors.push(`Tiêu đề tối đa ${L.REQUEST_TITLE_MAX} ký tự.`);
    if (details.length < L.REQUEST_DETAILS_MIN) errors.push(`Mô tả chi tiết ít nhất ${L.REQUEST_DETAILS_MIN} ký tự để quản trị viên xử lý được.`);
    if (details.length > L.REQUEST_DETAILS_MAX) errors.push(`Mô tả tối đa ${L.REQUEST_DETAILS_MAX} ký tự.`);

    const mine = await RecipeRequest.find({ user: req.user._id, status: { $in: OPEN_STATUSES } });
    if (mine.length >= L.OPEN_REQUESTS_PER_USER) {
      errors.push(`Bạn đang có ${mine.length} yêu cầu chờ xử lý. Hãy đợi quản trị viên phản hồi trước khi gửi thêm.`);
    }
    const key = `${type}|${recipe?._id || ''}|${title.toLowerCase()}`;
    if (mine.some(r => `${r.type}|${r.recipe || ''}|${r.title.toLowerCase()}` === key)) {
      errors.push('Bạn đã gửi yêu cầu này và nó đang chờ xử lý.');
    }
    if (errors.length) {
      return next(createError(400, errors[0], { errors: errors.map(message => ({ message })), code: 'VALIDATION_ERROR' }));
    }

    const request = await RecipeRequest.create({
      user: req.user._id,
      userEmail: req.user.email,
      userName: req.user.fullName || req.user.email,
      type,
      title: title || `${TYPE_LABELS[type]}: ${recipe?.title || ''}`.trim(),
      details,
      recipe: recipe?._id || null,
      recipeTitle: recipe?.title || ''
    });
    res.status(201).json({ success: true, message: 'Đã gửi yêu cầu tới quản trị viên', request: formatRequest(request) });
  } catch (error) {
    next(error);
  }
};

// @desc    My requests, newest first
// @route   GET /api/requests/mine
// @access  Private
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await RecipeRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: requests.length, requests: requests.map(formatRequest) });
  } catch (error) {
    next(error);
  }
};

// @desc    All requests (admin), newest first, with counts per status
// @route   GET /api/requests?status=&type=
// @access  Private (Admin)
exports.getAllRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (L.REQUEST_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (L.REQUEST_TYPES.includes(req.query.type)) filter.type = req.query.type;
    const [requests, counts] = await Promise.all([
      RecipeRequest.find(filter).sort({ createdAt: -1 }).limit(500),
      countByStatus({})
    ]);
    res.status(200).json({ success: true, count: requests.length, counts, requests: requests.map(formatRequest) });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin review: change the status and/or reply
// @route   PATCH /api/requests/:id
// @access  Private (Admin)
// @body    { status?, adminReply? }
exports.updateRequest = async (req, res, next) => {
  try {
    const request = await findRequestOr404(req.params.id);
    const { status, adminReply } = req.body;
    if (status !== undefined) request.status = status;
    if (adminReply !== undefined) request.adminReply = String(adminReply ?? '').trim().slice(0, L.REQUEST_DETAILS_MAX);
    await request.save();
    res.status(200).json({ success: true, message: 'Đã cập nhật yêu cầu', request: formatRequest(request) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a request (its author or an admin)
// @route   DELETE /api/requests/:id
// @access  Private
exports.deleteRequest = async (req, res, next) => {
  try {
    const request = await findRequestOr404(req.params.id);
    const isAuthor = request.user.equals(req.user._id);
    if (!isAuthor && req.user.role !== 'admin') {
      return next(createError(404, 'Không tìm thấy yêu cầu'));
    }
    await request.deleteOne();
    res.status(200).json({ success: true, message: 'Đã xóa yêu cầu', deletedId: req.params.id });
  } catch (error) {
    next(error);
  }
};

exports.countByStatus = countByStatus;
