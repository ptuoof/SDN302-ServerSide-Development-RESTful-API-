// Password rule shared with the app (src/utils/authValidation.js):
// at least 8 characters and a "medium" strength (3 of: length, lowercase, uppercase, digit, symbol).
const { PASSWORD_MIN } = require('../config/limits');

const passwordStrength = (value = '') => {
  const checks = [value.length >= PASSWORD_MIN, /[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  const score = checks.filter(Boolean).length;
  return { score, label: score < 3 ? 'Yếu' : score < 5 ? 'Trung bình' : 'Mạnh', checks };
};

const isAcceptablePassword = value => typeof value === 'string' && value.length >= PASSWORD_MIN && passwordStrength(value).score >= 3;

const PASSWORD_RULE_MESSAGE = `Mật khẩu cần từ ${PASSWORD_MIN} ký tự và đạt mức trung bình trở lên (kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt).`;

module.exports = { passwordStrength, isAcceptablePassword, PASSWORD_RULE_MESSAGE };
