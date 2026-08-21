const express = require('express');
const pool = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const { generatePassword, hashPassword } = require('../../utils/fileHelpers');

const router = express.Router();
const REQUEST_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

router.use(requireAdmin);

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function cleanNotes(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
}

async function getSupportRequest(id) {
  const [rows] = await pool.query(
    `SELECT sr.id, sr.request_type, sr.company_name, sr.account_identifier, sr.message,
            sr.client_id, sr.status, sr.admin_notes, sr.created_at, sr.updated_at,
            sr.resolved_at, sr.password_reset_at,
            c.client_login_id AS matched_client_login_id,
            c.company_name AS matched_company_name,
            a.username AS resolved_by_username,
            pr.username AS password_reset_by_username
     FROM support_requests sr
     LEFT JOIN clients c ON c.id = sr.client_id
     LEFT JOIN admins a ON a.id = sr.resolved_by
     LEFT JOIN admins pr ON pr.id = sr.password_reset_by
     WHERE sr.id = ?`,
    [id]
  );
  return rows[0] || null;
}

router.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status && !REQUEST_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid support request status' });
    }

    const params = [];
    let where = '';
    if (status) {
      where = 'WHERE sr.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT sr.id, sr.request_type, sr.company_name, sr.account_identifier, sr.message,
              sr.client_id, sr.status, sr.admin_notes, sr.created_at, sr.updated_at,
              sr.resolved_at, sr.password_reset_at,
              c.client_login_id AS matched_client_login_id,
              c.company_name AS matched_company_name,
              a.username AS resolved_by_username,
              pr.username AS password_reset_by_username
       FROM support_requests sr
       LEFT JOIN clients c ON c.id = sr.client_id
       LEFT JOIN admins a ON a.id = sr.resolved_by
       LEFT JOIN admins pr ON pr.id = sr.password_reset_by
       ${where}
       ORDER BY FIELD(sr.status, 'open', 'in_progress', 'resolved', 'closed'), sr.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to load support requests' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid support request' });
    }

    const status = typeof req.body.status === 'string' ? req.body.status.trim() : '';
    const adminNotes = cleanNotes(req.body.adminNotes);
    if (!REQUEST_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid support request status' });
    }

    const existing = await getSupportRequest(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Support request not found' });
    }

    const isResolved = ['resolved', 'closed'].includes(status);
    await pool.query(
      `UPDATE support_requests
       SET status = ?,
           admin_notes = ?,
           resolved_by = CASE WHEN ? THEN COALESCE(resolved_by, ?) ELSE NULL END,
           resolved_at = CASE WHEN ? THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE NULL END
       WHERE id = ?`,
      [status, adminNotes || null, isResolved, req.user.id, isResolved, req.params.id]
    );

    return res.json({ success: true, data: await getSupportRequest(req.params.id) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to update the support request' });
  }
});

router.post('/:id/reset-password', async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid support request' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requestRows] = await connection.query(
      `SELECT id, request_type, client_id, status, password_reset_at
       FROM support_requests WHERE id = ? FOR UPDATE`,
      [req.params.id]
    );
    const request = requestRows[0];
    if (!request) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Support request not found' });
    }
    if (request.request_type !== 'password_reset') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'This is not a password reset request' });
    }
    if (!request.client_id) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'This request could not be matched to an active client account' });
    }
    if (request.password_reset_at || ['resolved', 'closed'].includes(request.status)) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'This password reset request has already been completed' });
    }

    const [clientRows] = await connection.query(
      'SELECT id, client_login_id, company_name FROM clients WHERE id = ? FOR UPDATE',
      [request.client_id]
    );
    const client = clientRows[0];
    if (!client) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'The matched client account is no longer active' });
    }

    const plaintextPassword = generatePassword(12);
    const passwordHash = await hashPassword(plaintextPassword);
    await connection.query(
      'UPDATE clients SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?',
      [passwordHash, client.id]
    );
    await connection.query(
      `UPDATE support_requests
       SET status = 'resolved', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP,
           password_reset_by = ?, password_reset_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, req.user.id, request.id]
    );
    await connection.commit();

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        requestId: request.id,
        client: {
          id: client.id,
          clientLoginId: client.client_login_id,
          companyName: client.company_name,
        },
        plaintextPassword,
      },
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ success: false, error: 'Unable to generate a temporary password' });
  } finally {
    connection.release();
  }
});

module.exports = router;