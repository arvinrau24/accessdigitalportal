const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../../db');
const config = require('../../config');
const { requireClient } = require('../../middleware/auth');
const { sanitizeFilename, getClientSubDir, isAllowedUpload } = require('../../utils/fileHelpers');
const { generateOnboardingPdf } = require('../../services/pdfFiller');
const { checkAndUpdateClientStatus, clientCanEdit, markDraftStatus } = require('../../services/submission');

const router = express.Router();
router.use(requireClient);

const REQUIRED_FIELDS = [
  'company_name',
  'company_office_address',
  'company_registration_no',
  'car_park_site_name',
  'car_park_site_address',
  'car_park_type',
  'authorized_email',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'declaration_name',
];

async function getClientRecord(clientId) {
  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [clientId]);
  return rows[0] || null;
}

function makeUpload(clientLoginId, subfolder) {
  const dir = getClientSubDir(clientLoginId, subfolder);
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => cb(null, `${Date.now()}_${sanitizeFilename(file.originalname)}`),
    }),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
      if (isAllowedUpload(file)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
      }
    },
  });
}

router.get('/', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    const [rows] = await pool.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    const form = rows[0] || null;
    if (form && form.form_data) {
      form.form_data = typeof form.form_data === 'string' ? JSON.parse(form.form_data) : form.form_data;
    }
    return res.json({
      success: true,
      data: {
        form,
        canEdit: clientCanEdit(client.status),
        commercialMode: client.commercial_mode,
        status: client.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/draft', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    if (!clientCanEdit(client.status)) {
      return res.status(403).json({ success: false, error: 'Editing is not allowed in current status' });
    }

    const formData = req.body.form_data || req.body;
    const jsonData = JSON.stringify(formData);

    const [existing] = await pool.query(
      'SELECT id FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE onboarding_forms SET form_data = ?, is_draft = TRUE, updated_at = NOW() WHERE id = ?',
        [jsonData, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO onboarding_forms (client_id, form_data, is_draft) VALUES (?, ?, TRUE)',
        [req.user.id, jsonData]
      );
    }

    await markDraftStatus(pool, req.user.id);
    const [rows] = await pool.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    if (!clientCanEdit(client.status)) {
      return res.status(403).json({ success: false, error: 'Submission is not allowed in current status' });
    }

    const formData = req.body.form_data || req.body;
    for (const field of REQUIRED_FIELDS) {
      if (!formData[field] || String(formData[field]).trim() === '') {
        return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
      }
    }

    const [existing] = await pool.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );

    let signaturePath = existing[0]?.signature_path || null;
    let stampPath = existing[0]?.stamp_path || null;

    if (!signaturePath) {
      return res.status(400).json({ success: false, error: 'Signature is required before submission' });
    }

    const jsonData = JSON.stringify(formData);
    const generatedDir = getClientSubDir(client.client_login_id, 'generated');
    const pdfFileName = `onboarding-${Date.now()}.pdf`;
    const pdfPath = path.join(generatedDir, pdfFileName);

    const pdfBytes = await generateOnboardingPdf(formData, {
      signaturePath,
      stampPath,
      commercialMode: client.commercial_mode,
      submissionDate: new Date(),
    });
    fs.writeFileSync(pdfPath, pdfBytes);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE onboarding_forms SET form_data = ?, generated_pdf_path = ?, is_draft = FALSE, submitted_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [jsonData, pdfPath, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO onboarding_forms (client_id, form_data, signature_path, stamp_path, generated_pdf_path, is_draft, submitted_at)
         VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
        [req.user.id, jsonData, signaturePath, stampPath, pdfPath]
      );
    }

    await checkAndUpdateClientStatus(pool, req.user.id);
    const [rows] = await pool.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/signature', async (req, res, next) => {
  try {
    const client = await getClientRecord(req.user.id);
    if (!clientCanEdit(client.status)) {
      return res.status(403).json({ success: false, error: 'Editing is not allowed in current status' });
    }
    const upload = makeUpload(client.client_login_id, 'signatures').single('signature');
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'Signature file required' });

      const [existing] = await pool.query(
        'SELECT id FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
        [req.user.id]
      );
      if (existing.length > 0) {
        await pool.query('UPDATE onboarding_forms SET signature_path = ? WHERE id = ?', [
          req.file.path,
          existing[0].id,
        ]);
      } else {
        await pool.query(
          'INSERT INTO onboarding_forms (client_id, form_data, signature_path, is_draft) VALUES (?, ?, ?, TRUE)',
          [req.user.id, JSON.stringify({}), req.file.path]
        );
      }
      return res.json({ success: true, data: { signature_path: req.file.path } });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stamp', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    if (!clientCanEdit(client.status)) {
      return res.status(403).json({ success: false, error: 'Editing is not allowed in current status' });
    }
    const upload = makeUpload(client.client_login_id, 'stamps').single('stamp');
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'Stamp file required' });

      const [existing] = await pool.query(
        'SELECT id FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
        [req.user.id]
      );
      if (existing.length > 0) {
        await pool.query('UPDATE onboarding_forms SET stamp_path = ? WHERE id = ?', [
          req.file.path,
          existing[0].id,
        ]);
      } else {
        await pool.query(
          'INSERT INTO onboarding_forms (client_id, form_data, stamp_path, is_draft) VALUES (?, ?, ?, TRUE)',
          [req.user.id, JSON.stringify({}), req.file.path]
        );
      }
      return res.json({ success: true, data: { stamp_path: req.file.path } });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
