const jwt = require('jsonwebtoken');

// JWT configuration
const jwtConfig = {
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_EXP || '15m',
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXP || '30d',
  },
};

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.accessToken.secret);
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshToken.secret);
};

// Generate token pair
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

module.exports = {
  generateTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};