const express = require('express');
const path = require('path');
const multer = require('multer');
const pool = require('../../db');
const config = require('../../config');
const { requireClient } = require('../../middleware/auth');
const { sanitizeFilename, getClientSubDir, isAllowedUpload } = require('../../utils/fileHelpers');
const { clientCanEdit, markDraftStatus } = require('../../services/submission');
const { sendFile } = require('../../utils/fileServe');
const fs = require('fs');

const router = express.Router();
router.use(requireClient);

async function getClientRecord(clientId) {
  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [clientId]);
  return rows[0] || null;
}

function makeUploader(clientLoginId) {
  const dir = getClientSubDir(clientLoginId, 'template-uploads');
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => cb(null, `${Date.now()}_${sanitizeFilename(file.originalname)}`),
    }),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
      if (isAllowedUpload(file)) cb(null, true);
      else cb(new Error('Invalid file type'));
    },
  }).single('file');
}

router.get('/', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    const [templates] = await pool.query(
      `SELECT id, original_filename, uploaded_at FROM templates WHERE client_type = ? ORDER BY uploaded_at DESC`,
      [client.client_type]
    );
    const [uploads] = await pool.query(
      'SELECT id, template_id, original_filename, is_draft, uploaded_at FROM template_uploads WHERE client_id = ?',
      [req.user.id]
    );
    const uploadByTemplate = Object.fromEntries(uploads.map((u) => [u.template_id, u]));

    return res.json({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        displayName: t.original_filename,
        uploadedAt: t.uploaded_at,
        filled: uploadByTemplate[t.id] || null,
      })),
      canEdit: clientCanEdit(client.status),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    const [templateRows] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);

    if (templateRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (templateRows[0].client_type !== client.client_type) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return sendFile(
      res,
      templateRows[0].file_path,
      templateRows[0].original_filename || path.basename(templateRows[0].file_path)
    );
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/upload', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    if (!clientCanEdit(client.status)) {
      return res.status(403).json({ success: false, error: 'Editing is not allowed in current status' });
    }

    const [templateRows] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (templateRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (templateRows[0].client_type !== client.client_type) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const uploader = makeUploader(client.client_login_id);
    uploader(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'File is required' });

      const [existing] = await pool.query(
        'SELECT id, file_path FROM template_uploads WHERE client_id = ? AND template_id = ?',
        [req.user.id, req.params.id]
      );
      if (existing.length > 0) {
        if (existing[0].file_path !== req.file.path && fs.existsSync(existing[0].file_path)) {
          fs.unlinkSync(existing[0].file_path);
        }
        await pool.query(
          `UPDATE template_uploads SET file_path = ?, original_filename = ?, is_draft = TRUE, uploaded_at = NOW()
           WHERE id = ?`,
          [req.file.path, req.file.originalname, existing[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO template_uploads (client_id, template_id, file_path, original_filename, is_draft)
           VALUES (?, ?, ?, ?, TRUE)`,
          [req.user.id, req.params.id, req.file.path, req.file.originalname]
        );
      }

      await markDraftStatus(pool, req.user.id);
      return res.json({ success: true });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
