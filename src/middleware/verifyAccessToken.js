const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');

// Middleware to verify access token
const verifyAccessTokenMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided or invalid format.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from token (optional: remove password)
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.',
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Token verification failed.',
    });
  }
};

module.exports = verifyAccessTokenMiddleware;