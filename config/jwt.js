// Centralized JWT configuration.
// The secret MUST come from environment variables - never hardcode it in source code.
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables (.env)');
  }
  return secret;
};

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

module.exports = { getJwtSecret, getJwtExpiresIn };
