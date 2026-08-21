const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');

function getTokenFromRequest(req) {
  return req.cookies?.[config.jwt.cookieName] || null;
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  res.cookie(config.jwt.cookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(config.jwt.cookieName, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
}

function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = null;
    }
  }
  next();
}

async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    req.user = verifyToken(token);
    if (req.user.role === 'client') {
      const [rows] = await pool.query('SELECT auth_version FROM clients WHERE id = ?', [req.user.id]);
      const currentVersion = rows[0]?.auth_version;
      if (currentVersion === undefined || Number(req.user.authVersion || 0) !== Number(currentVersion)) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, error: 'Your session has expired. Please sign in again.' });
      }
    }
    return next();
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
      return next(err);
    }
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    return next();
  });
}

function requireClient(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'client') {
      return res.status(403).json({ success: false, error: 'Client access required' });
    }
    return next();
  });
}

module.exports = {
  getTokenFromRequest,
  setAuthCookie,
  clearAuthCookie,
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireClient,
};
