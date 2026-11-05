const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALLERGEN_IDS, DEFAULT_CALORIE_GOAL, CALORIE_GOAL_MIN, CALORIE_GOAL_MAX, NAME_MAX } = require('../config/limits');

// One-time code (email verification / password reset). Only a hash of the code is stored.
const otpSubSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 }
  },
  { _id: false }
);

// Personal app settings (mirrors DEFAULT_SETTINGS in the mobile app's RecipeContext)
const settingsSubSchema = new mongoose.Schema(
  {
    keepAwake: { type: Boolean, default: true },
    timerSound: { type: Boolean, default: true },
    vibration: { type: Boolean, default: true },
    timerNotifications: { type: Boolean, default: true },
    assumeStaples: { type: Boolean, default: true },
    autoStockPantry: { type: Boolean, default: true },
    allergies: { type: [{ type: String, enum: ALLERGEN_IDS }], default: [] },
    hideAllergenRecipes: { type: Boolean, default: true },
    calorieGoal: { type: Number, default: DEFAULT_CALORIE_GOAL, min: CALORIE_GOAL_MIN, max: CALORIE_GOAL_MAX }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username là bắt buộc'],
      unique: true,
      trim: true,
      minlength: [3, 'Username cần ít nhất 3 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ']
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc']
    },
    fullName: {
      type: String,
      required: [true, 'Họ tên là bắt buộc'],
      trim: true,
      maxlength: [NAME_MAX, `Họ tên tối đa ${NAME_MAX} ký tự`]
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    // Email confirmed with the 6-digit code. Accounts created before this field existed count as verified.
    verified: { type: Boolean, default: true },
    // Locked by an admin: cannot sign in and existing tokens stop working
    locked: { type: Boolean, default: false },
    settings: { type: settingsSubSchema, default: () => ({}) },
    hasSeenOnboarding: { type: Boolean, default: false },
    verifyOtp: { type: otpSubSchema, default: undefined, select: false },
    resetOtp: { type: otpSubSchema, default: undefined, select: false }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.verifyOtp;
        delete ret.resetOtp;
        return ret;
      }
    }
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
