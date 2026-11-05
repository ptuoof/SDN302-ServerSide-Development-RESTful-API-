const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const { User } = require('../models');
const { getJwtSecret, getJwtExpiresIn } = require('../config/jwt');
const { formatUser, formatSettings } = require('../utils/serializers');
const { isAcceptablePassword, PASSWORD_RULE_MESSAGE } = require('../utils/password');
const { createOtp, checkOtp, isCoolingDown, deliverCode, devFields, OTP_ERRORS } = require('../utils/otp');
const { tokensOf } = require('../utils/text');

const DEFAULT_AVATAR = User.schema.path('avatar').defaultValue;

const generateToken = user => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
};

const nameFrom = body => String(body?.name ?? body?.fullName ?? '').trim();
const emailFrom = value => String(value ?? '').trim().toLowerCase();

/** "nguyen.van.a@gmail.com" -> "nguyen_van_a", made unique with a number suffix. */
const uniqueUsername = async (wanted, email) => {
  const base = (tokensOf(wanted || email.split('@')[0]).join('_') || 'user').slice(0, 24).padEnd(3, '0');
  let username = base;
  for (let n = 2; await User.exists({ username }); n += 1) {
    username = `${base}${n}`;
  }
  return username;
};

const signInResponse = (res, status, user, message) => res.status(status).json({
  success: true,
  message,
  token: generateToken(user),
  user: formatUser(user)
});

/** Issues and "delivers" a new email verification code. */
const issueVerifyCode = async user => {
  const { otp, code } = createOtp(user._id);
  user.verifyOtp = otp;
  await user.save();
  await deliverCode(user, code, 'verify');
  return code;
};

// @desc    Register new user. The account must then be verified with the 6-digit code.
// @route   POST /api/auth/register
// @access  Public
// @body    { name, email, password }  (also accepts { fullName, username, avatar })
exports.register = async (req, res, next) => {
  try {
    const { password, avatar } = req.body;
    const email = emailFrom(req.body.email);
    const fullName = nameFrom(req.body);

    if (!isAcceptablePassword(password)) {
      return next(createError(400, PASSWORD_RULE_MESSAGE, { code: 'WEAK_PASSWORD' }));
    }

    const wantedUsername = String(req.body.username ?? '').trim();
    const existingUser = await User.findOne({
      $or: [{ email }, ...(wantedUsername ? [{ username: wantedUsername }] : [])]
    });
    if (existingUser) {
      const sameEmail = existingUser.email === email;
      return next(createError(409, sameEmail ? 'Email này đã được đăng ký. Hãy đăng nhập.' : 'Username đã được sử dụng.', {
        code: sameEmail ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN'
      }));
    }

    const user = await User.create({
      username: wantedUsername || (await uniqueUsername(fullName, email)),
      email,
      password: await bcrypt.hash(password, 10),
      fullName,
      avatar: avatar || undefined,
      verified: false
    });
    const code = await issueVerifyCode(user);

    res.status(201).json({
      success: true,
      message: 'Tài khoản đã tạo. Nhập mã xác minh 6 chữ số để tiếp tục.',
      requiresVerification: true,
      email: user.email,
      user: formatUser(user),
      ...devFields(code)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify the email with the 6-digit code -> signs the user in
// @route   POST /api/auth/verify-email
// @access  Public
// @body    { email, code }
exports.verifyEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: emailFrom(req.body.email) }).select('+verifyOtp');
    if (!user) {
      return next(createError(404, 'Không tìm thấy tài khoản cần xác minh.'));
    }
    if (user.verified) {
      return next(createError(400, 'Tài khoản đã được xác minh. Hãy đăng nhập.', { code: 'ALREADY_VERIFIED' }));
    }
    const result = checkOtp(user.verifyOtp, user._id, req.body.code);
    if (result !== 'ok') {
      if (result === 'wrong') {
        user.verifyOtp.attempts += 1;
        await user.save();
      }
      return next(createError(400, OTP_ERRORS[result], { code: 'INVALID_CODE' }));
    }
    user.verified = true;
    user.verifyOtp = undefined;
    await user.save();
    if (user.locked) {
      return next(createError(403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên CookFlow.', { code: 'ACCOUNT_LOCKED' }));
    }
    signInResponse(res, 200, user, 'Xác minh email thành công');
  } catch (error) {
    next(error);
  }
};

// @desc    Send a new verification code
// @route   POST /api/auth/resend-code
// @access  Public
// @body    { email }
exports.resendCode = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: emailFrom(req.body.email) }).select('+verifyOtp');
    let code = null;
    if (user && !user.verified) {
      if (isCoolingDown(user.verifyOtp)) {
        return next(createError(429, 'Mã vừa được gửi. Hãy đợi 30 giây rồi thử lại.', { code: 'TOO_SOON' }));
      }
      code = await issueVerifyCode(user);
    }
    // Same answer whether or not the email exists (does not reveal registered emails)
    res.status(200).json({
      success: true,
      message: 'Nếu email cần xác minh, mã mới đã được gửi.',
      ...devFields(code)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// @body    { email, password }  (also accepts { usernameOrEmail, password })
exports.login = async (req, res, next) => {
  try {
    const identifier = String(req.body.email ?? req.body.usernameOrEmail ?? req.body.username ?? '').trim();
    const { password } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }]
    }).select('+verifyOtp');

    if (!user || !(await user.comparePassword(password))) {
      return next(createError(401, 'Email hoặc mật khẩu chưa chính xác.', { code: 'INVALID_CREDENTIALS' }));
    }
    if (user.locked) {
      return next(createError(403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên CookFlow.', { code: 'ACCOUNT_LOCKED' }));
    }
    if (user.verified === false) {
      // A fresh code is sent so the app can go straight to the verification screen
      const code = isCoolingDown(user.verifyOtp) ? null : await issueVerifyCode(user);
      const message = 'Tài khoản chưa xác minh. Nhập mã xác minh đã gửi tới email của bạn.';
      return res.status(403).json({
        success: false,
        message,
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        error: { status: 403, message },
        ...devFields(code)
      });
    }

    signInResponse(res, 200, user, 'Đăng nhập thành công');
  } catch (error) {
    next(error);
  }
};

// @desc    Request a password reset code
// @route   POST /api/auth/forgot-password
// @access  Public
// @body    { email }
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: emailFrom(req.body.email) }).select('+resetOtp');
    let code = null;
    if (user && !user.locked) {
      if (isCoolingDown(user.resetOtp)) {
        return next(createError(429, 'Mã vừa được gửi. Hãy đợi 30 giây rồi thử lại.', { code: 'TOO_SOON' }));
      }
      const created = createOtp(user._id);
      user.resetOtp = created.otp;
      await user.save();
      await deliverCode(user, created.code, 'reset');
      code = created.code;
    }
    res.status(200).json({
      success: true,
      message: 'Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi.',
      ...devFields(code)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set a new password with the reset code
// @route   POST /api/auth/reset-password
// @access  Public
// @body    { email, code, newPassword }
exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!isAcceptablePassword(newPassword)) {
      return next(createError(400, PASSWORD_RULE_MESSAGE, { code: 'WEAK_PASSWORD' }));
    }
    const user = await User.findOne({ email: emailFrom(req.body.email) }).select('+resetOtp');
    if (!user) {
      return next(createError(400, OTP_ERRORS.missing, { code: 'INVALID_CODE' }));
    }
    const result = checkOtp(user.resetOtp, user._id, req.body.code);
    if (result !== 'ok') {
      if (result === 'wrong') {
        user.resetOtp.attempts += 1;
        await user.save();
      }
      return next(createError(400, OTP_ERRORS[result], { code: 'INVALID_CODE' }));
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.verified = true; // the code proved the user owns this email
    await user.save();
    res.status(200).json({ success: true, message: 'Đã đổi mật khẩu. Bạn có thể đăng nhập.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password of the signed-in user
// @route   PUT /api/auth/change-password
// @access  Private
// @body    { currentPassword, newPassword }
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return next(createError(400, 'Mật khẩu hiện tại chưa đúng.', { code: 'WRONG_PASSWORD' }));
    }
    if (!isAcceptablePassword(newPassword)) {
      return next(createError(400, PASSWORD_RULE_MESSAGE, { code: 'WEAK_PASSWORD' }));
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.status(200).json({ success: true, message: 'Đã đổi mật khẩu.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile (+ settings)
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      user: formatUser(user),
      settings: formatSettings(user),
      hasSeenOnboarding: !!user.hasSeenOnboarding
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
// @body    { name | fullName, avatar }  (avatar null or "" restores the default avatar)
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const rawName = req.body.name ?? req.body.fullName;

    if (rawName !== undefined) user.fullName = String(rawName).trim();
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar ? String(req.body.avatar).trim() : DEFAULT_AVATAR;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật hồ sơ',
      user: formatUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.uniqueUsername = uniqueUsername;
