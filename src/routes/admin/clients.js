const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const { generateClientLoginId } = require('../../services/clientId');
const { generatePassword, hashPassword, getClientUploadDir } = require('../../utils/fileHelpers');
const { resolveOnboardingStatus } = require('../../services/submission');

const router = express.Router();

router.use(requireAdmin);

router.post('/', async (req, res) => {
  try {
    const { company_name, client_type, commercial_mode } = req.body;
    const validModes = ['Outright Purchase', 'Lease to Own', 'Rent'];
    if (!company_name || !client_type || !commercial_mode) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    if (!['A', 'B'].includes(client_type)) {
      return res.status(400).json({ success: false, error: 'Invalid client type' });
    }
    if (!validModes.includes(commercial_mode)) {
      return res.status(400).json({ success: false, error: 'Invalid commercial mode' });
    }

    const clientLoginId = await generateClientLoginId(company_name);
    const plaintextPassword = generatePassword(10);
    const passwordHash = await hashPassword(plaintextPassword);

    const [result] = await pool.query(
      `INSERT INTO clients (client_login_id, company_name, client_type, commercial_mode, password_hash, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending_onboarding', ?)`,
      [clientLoginId, company_name, client_type, commercial_mode, passwordHash, req.user.id]
    );

    fs.mkdirSync(getClientUploadDir(clientLoginId), { recursive: true });

    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    const client = rows[0];
    delete client.password_hash;

    return res.status(201).json({
      success: true,
      data: { client, plaintextPassword },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.client_login_id, c.company_name, c.client_type, c.commercial_mode, c.status,
              c.rejection_reason, c.created_at, c.updated_at,
              o.is_draft AS onboarding_is_draft, o.submitted_at AS onboarding_submitted_at
       FROM clients c
       LEFT JOIN (
         SELECT o1.client_id, o1.is_draft, o1.submitted_at
         FROM onboarding_forms o1
         INNER JOIN (
           SELECT client_id, MAX(id) AS max_id FROM onboarding_forms GROUP BY client_id
         ) latest ON latest.max_id = o1.id
       ) o ON o.client_id = c.id
       ORDER BY c.created_at DESC`
    );
    const data = rows.map((row) => {
      const onboarding = row.onboarding_is_draft === null
        ? null
        : { is_draft: row.onboarding_is_draft, submitted_at: row.onboarding_submitted_at };
      const onboardingStatus = resolveOnboardingStatus(onboarding, row.status);
      return {
        ...row,
        onboardingStatus: onboardingStatus.key,
        onboardingStatusLabel: onboardingStatus.label,
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const [clientRows] = await pool.query(
      `SELECT id, client_login_id, company_name, client_type, commercial_mode, status, rejection_reason, created_at, updated_at
       FROM clients WHERE id = ?`,
      [clientId]
    );
    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const [onboardingRows] = await pool.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [clientId]
    );
    const [docRows] = await pool.query(
      'SELECT id, doc_type, file_path, is_draft, uploaded_at FROM uploaded_documents WHERE client_id = ?',
      [clientId]
    );
    const [templateUploadRows] = await pool.query(
      `SELECT tu.id, tu.template_id, tu.original_filename, tu.is_draft, tu.uploaded_at, t.original_filename AS template_name
       FROM template_uploads tu
       JOIN templates t ON t.id = tu.template_id
       WHERE tu.client_id = ?`,
      [clientId]
    );
    const [reviewRows] = await pool.query(
      `SELECT rl.*, a.username AS admin_username
       FROM review_log rl JOIN admins a ON rl.admin_id = a.id
       WHERE rl.client_id = ? ORDER BY rl.created_at DESC`,
      [clientId]
    );

    const onboarding = onboardingRows[0] || null;
    if (onboarding && onboarding.form_data) {
      onboarding.form_data = typeof onboarding.form_data === 'string'
        ? JSON.parse(onboarding.form_data)
        : onboarding.form_data;
    }
    const onboardingStatus = resolveOnboardingStatus(onboarding, clientRows[0].status);

    return res.json({
      success: true,
      data: {
        client: clientRows[0],
        onboarding,
        onboardingStatus: onboardingStatus.key,
        onboardingStatusLabel: onboardingStatus.label,
        documents: docRows,
        templateUploads: templateUploadRows,
        reviewLog: reviewRows,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const [rows] = await pool.query('SELECT client_login_id FROM clients WHERE id = ?', [clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const uploadDir = getClientUploadDir(rows[0].client_login_id);
    await pool.query('DELETE FROM clients WHERE id = ?', [clientId]);
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
