// 6-digit one-time codes for email verification and password reset.
//
// No mail server is configured in this project, so the code is "delivered" by:
//   - printing it in the server console, and
//   - returning it as `devCode` in the API response while NODE_ENV !== 'production'
//     (set OTP_EXPOSE_IN_RESPONSE=false to turn that off).
// To send real emails later, implement deliverCode() with nodemailer/SMTP; nothing else changes.
const crypto = require('crypto');
const { OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS } = require('../config/limits');

const RESEND_COOLDOWN_MS = 30 * 1000;

const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

/** Returns { otp, code }: `otp` is what is stored on the user (hash only). */
const createOtp = userId => {
  const code = generateCode();
  return {
    code,
    otp: {
      codeHash: hashCode(userId, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      attempts: 0
    }
  };
};

/** True when a new code was issued less than RESEND_COOLDOWN_MS ago. */
const isCoolingDown = otp => !!otp?.expiresAt && otp.expiresAt.getTime() - OTP_TTL_MINUTES * 60 * 1000 + RESEND_COOLDOWN_MS > Date.now();

/**
 * Checks a code against the stored otp. Returns 'ok' | 'missing' | 'expired' | 'too_many' | 'wrong'.
 * The caller must persist otp.attempts after a 'wrong' result.
 */
const checkOtp = (otp, userId, code) => {
  if (!otp?.codeHash) return 'missing';
  if (otp.expiresAt.getTime() < Date.now()) return 'expired';
  if ((otp.attempts || 0) >= OTP_MAX_ATTEMPTS) return 'too_many';
  const expected = Buffer.from(otp.codeHash, 'hex');
  const actual = Buffer.from(hashCode(userId, String(code).trim()), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? 'ok' : 'wrong';
};

const OTP_ERRORS = {
  missing: 'Mã không còn hiệu lực. Hãy yêu cầu gửi mã mới.',
  expired: `Mã đã hết hạn (hiệu lực ${OTP_TTL_MINUTES} phút). Hãy yêu cầu gửi mã mới.`,
  too_many: 'Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu gửi mã mới.',
  wrong: 'Mã chưa chính xác.'
};

const exposeInResponse = () => process.env.NODE_ENV !== 'production' && process.env.OTP_EXPOSE_IN_RESPONSE !== 'false';

const deliverCode = async (user, code, purpose) => {
  if (process.env.NODE_ENV !== 'production') {
    const label = purpose === 'reset' ? 'đặt lại mật khẩu' : 'xác minh email';
    console.log(`[OTP] Mã ${label} cho ${user.email}: ${code} (hết hạn sau ${OTP_TTL_MINUTES} phút)`);
  }
};

/** Extra response fields carrying the code in development. */
const devFields = code => (exposeInResponse() && code ? { devCode: code } : {});

module.exports = { createOtp, checkOtp, isCoolingDown, deliverCode, devFields, OTP_ERRORS };
