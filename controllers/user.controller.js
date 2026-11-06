const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const createError = require('http-errors');
const { User, Recipe } = require('../models');
const { formatUser, formatSettings } = require('../utils/serializers');
const escapeRegex = require('../utils/escapeRegex');
const { uniqueUsername } = require('./auth.controller');
const userData = require('../services/userData.service');

const nameFrom = body => {
  const raw = body?.name ?? body?.fullName;
  return raw === undefined ? undefined : String(raw).trim();
};

const findUserOr404 = async id => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy người dùng');
  const user = await User.findById(id);
  if (!user) throw createError(404, 'Không tìm thấy người dùng');
  return user;
};

const otherAdmins = userId => User.countDocuments({ role: 'admin', _id: { $ne: userId } });

// ===========================================================================
// Signed-in user: settings & personal data
// ===========================================================================

// @desc    Get my app settings + onboarding flag
// @route   GET /api/users/me/settings
// @access  Private
exports.getMySettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, settings: formatSettings(user), hasSeenOnboarding: !!user.hasSeenOnboarding });
  } catch (error) {
    next(error);
  }
};

// @desc    Update my settings (partial). Unknown keys are ignored; calorieGoal is clamped to 800-6000.
// @route   PUT /api/users/me/settings
// @access  Private
// @body    { keepAwake?, timerSound?, vibration?, timerNotifications?, assumeStaples?, autoStockPantry?,
//            allergies?, hideAllergenRecipes?, calorieGoal?, hasSeenOnboarding? }
exports.updateMySettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    userData.applySettings(user, req.body);
    if (typeof req.body.hasSeenOnboarding === 'boolean') user.hasSeenOnboarding = req.body.hasSeenOnboarding;
    await user.save();
    res.status(200).json({ success: true, settings: formatSettings(user), hasSeenOnboarding: !!user.hasSeenOnboarding });
  } catch (error) {
    next(error);
  }
};

// @desc    Export my personal data in the app's backup format
// @route   GET /api/users/me/data
// @access  Private
exports.exportMyData = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, backup: await userData.exportBackup(req.user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Replace my personal data with a backup (format "cookflow-backup")
// @route   POST /api/users/me/data/import
// @access  Private
exports.importMyData = async (req, res, next) => {
  try {
    const summary = await userData.importBackup(req.user, req.body?.backup || req.body);
    res.status(200).json({ success: true, message: 'Đã khôi phục dữ liệu từ bản sao lưu', summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete every personal recipe, list, history entry, meal plan entry and setting
// @route   DELETE /api/users/me/data
// @access  Private
exports.resetMyData = async (req, res, next) => {
  try {
    await userData.resetPersonalData(req.user);
    res.status(200).json({ success: true, message: 'Đã xóa toàn bộ dữ liệu cá nhân' });
  } catch (error) {
    next(error);
  }
};

// ===========================================================================
// Admin: user management
// ===========================================================================

// @desc    List users (admins first, then by email)
// @route   GET /api/users?search=&role=&locked=
// @access  Private (Admin)
exports.listUsers = async (req, res, next) => {
  try {
    const { search, role, locked } = req.query;
    const filter = {};
    if (role === 'user' || role === 'admin') filter.role = role;
    if (locked === 'true' || locked === 'false') filter.locked = locked === 'true';
    if (search && String(search).trim()) {
      const safe = escapeRegex(String(search).trim());
      filter.$or = [{ email: { $regex: safe, $options: 'i' } }, { fullName: { $regex: safe, $options: 'i' } }, { username: { $regex: safe, $options: 'i' } }];
    }
    const users = await User.find(filter).select('-password');
    users.sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1));
    res.status(200).json({
      success: true,
      count: users.length,
      stats: {
        users: users.filter(u => u.role !== 'admin').length,
        admins: users.filter(u => u.role === 'admin').length,
        locked: users.filter(u => u.locked).length,
        unverified: users.filter(u => u.verified === false).length
      },
      users: users.map(formatUser)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get one user
// @route   GET /api/users/:id
// @access  Private (Admin)
exports.getUser = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, user: formatUser(await findUserOr404(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a user
// @route   POST /api/users
// @access  Private (Admin)
// @body    { email, name, password, role?, verified? (default true), locked? }
exports.createUser = async (req, res, next) => {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    if (await User.exists({ email })) {
      return next(createError(409, 'Email này đã có tài khoản.', { code: 'EMAIL_TAKEN' }));
    }
    const fullName = nameFrom(req.body);
    const user = await User.create({
      username: await uniqueUsername(req.body.username || fullName, email),
      email,
      fullName,
      password: await bcrypt.hash(req.body.password, 10),
      role: req.body.role === 'admin' ? 'admin' : 'user',
      verified: req.body.verified !== false,
      locked: req.body.locked === true
    });
    res.status(201).json({ success: true, message: 'Đã tạo tài khoản', user: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit a user (name, email, role, verified, locked, password)
// @route   PUT /api/users/:id
// @access  Private (Admin)
// Rules: an admin cannot demote / lock / change the email of their own account, and the last
// admin can never be demoted or locked.
exports.updateUser = async (req, res, next) => {
  try {
    const user = await findUserOr404(req.params.id);
    const isSelf = user._id.equals(req.user._id);
    const { role, verified, locked, password } = req.body;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const fullName = nameFrom(req.body);

    if (isSelf && ((role !== undefined && role !== 'admin') || locked === true)) {
      return next(createError(400, 'Không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập.'));
    }
    if (isSelf && email !== undefined && email !== user.email) {
      return next(createError(400, 'Không đổi email của tài khoản quản trị đang đăng nhập.'));
    }
    const losesAdmin = user.role === 'admin' && ((role !== undefined && role !== 'admin') || locked === true);
    if (losesAdmin && (await otherAdmins(user._id)) === 0) {
      return next(createError(400, 'Cần giữ lại ít nhất 1 tài khoản quản trị đang hoạt động.'));
    }
    if (email !== undefined && email !== user.email) {
      if (await User.exists({ email, _id: { $ne: user._id } })) {
        return next(createError(409, 'Email mới đã được dùng bởi tài khoản khác.', { code: 'EMAIL_TAKEN' }));
      }
      user.email = email;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined) user.role = role === 'admin' ? 'admin' : 'user';
    if (typeof verified === 'boolean') user.verified = verified;
    if (typeof locked === 'boolean') user.locked = locked;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    res.status(200).json({ success: true, message: 'Đã cập nhật tài khoản', user: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user and their personal data. Catalog recipes they authored move to the current admin.
// @route   DELETE /api/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await findUserOr404(req.params.id);
    if (user._id.equals(req.user._id)) {
      return next(createError(400, 'Không thể xóa tài khoản đang đăng nhập.'));
    }
    if (user.role === 'admin' && (await otherAdmins(user._id)) === 0) {
      return next(createError(400, 'Cần giữ lại ít nhất 1 tài khoản quản trị.'));
    }
    await userData.deletePersonalData(user._id, { keepAccount: false });
    await Recipe.updateMany({ author: user._id, type: { $ne: 'personal' } }, { author: req.user._id });
    await User.deleteOne({ _id: user._id });
    res.status(200).json({ success: true, message: 'Đã xóa tài khoản', deletedId: user._id.toString() });
  } catch (error) {
    next(error);
  }
};
