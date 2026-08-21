const express = require('express');
const pool = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');
const { comparePassword } = require('../utils/fileHelpers');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const admin = rows[0];
    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    setAuthCookie(res, { role: 'admin', id: admin.id, username: admin.username });
    return res.json({
      success: true,
      data: { role: 'admin', id: admin.id, username: admin.username },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/client/login', loginLimiter, async (req, res) => {
  try {
    const { clientLoginId, password } = req.body;
    if (!clientLoginId || !password) {
      return res.status(400).json({ success: false, error: 'Client ID and password required' });
    }

    const [rows] = await pool.query('SELECT * FROM clients WHERE client_login_id = ?', [clientLoginId]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const client = rows[0];
    const valid = await comparePassword(password, client.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    setAuthCookie(res, {
      role: 'client',
      id: client.id,
      clientLoginId: client.client_login_id,
      companyName: client.company_name,
      authVersion: client.auth_version || 0,
    });
    return res.json({
      success: true,
      data: {
        role: 'client',
        id: client.id,
        clientLoginId: client.client_login_id,
        companyName: client.company_name,
        status: client.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [rows] = await pool.query('SELECT id, username FROM admins WHERE id = ?', [req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      return res.json({ success: true, data: { role: 'admin', ...rows[0] } });
    }

    const [rows] = await pool.query(
      'SELECT id, client_login_id, company_name, commercial_mode, status FROM clients WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const client = rows[0];
    return res.json({
      success: true,
      data: {
        role: 'client',
        id: client.id,
        clientLoginId: client.client_login_id,
        companyName: client.company_name,
        commercialMode: client.commercial_mode,
        status: client.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
