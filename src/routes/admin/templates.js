const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../../db');
const config = require('../../config');
const { requireAdmin } = require('../../middleware/auth');
const { sanitizeFilename, ensureDir, isAllowedUpload } = require('../../utils/fileHelpers');
const { sendFile } = require('../../utils/fileServe');

const router = express.Router();
router.use(requireAdmin);

const templateDir = path.join(config.paths.uploads, 'templates');
ensureDir(templateDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templateDir),
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. PDF, Word, JPG, and PNG are allowed.'));
    }
  },
});

router.post('/', upload.array('files', 20), async (req, res) => {
  try {
    const { client_type } = req.body;
    const files = req.files || [];
    if (!client_type || files.length === 0) {
      return res.status(400).json({ success: false, error: 'client_type and at least one file are required' });
    }
    if (!['A', 'B'].includes(client_type)) {
      return res.status(400).json({ success: false, error: 'Invalid client type' });
    }

    const created = [];
    for (const file of files) {
      const originalName = file.originalname;
      const [result] = await pool.query(
        'INSERT INTO templates (client_type, original_filename, file_path, uploaded_by) VALUES (?, ?, ?, ?)',
        [client_type, originalName, file.path, req.user.id]
      );
      const [rows] = await pool.query('SELECT * FROM templates WHERE id = ?', [result.insertId]);
      created.push(rows[0]);
    }

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, client_type, original_filename, file_path, uploaded_by, uploaded_at
       FROM templates ORDER BY client_type, uploaded_at DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    if (fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }
    await pool.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    const name = rows[0].original_filename || path.basename(rows[0].file_path);
    return sendFile(res, rows[0].file_path, name);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
