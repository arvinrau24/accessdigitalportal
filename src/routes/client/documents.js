const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../../db');
const config = require('../../config');
const { requireClient } = require('../../middleware/auth');
const { sanitizeFilename, getClientSubDir, isAllowedUpload } = require('../../utils/fileHelpers');
const { checkAndUpdateClientStatus, clientCanEdit, REQUIRED_DOC_TYPES, markDraftStatus, requiredTemplateIds } = require('../../services/submission');
const { sendFile } = require('../../utils/fileServe');

const router = express.Router();
router.use(requireClient);

const DOC_LABELS = {
  bank_statement: 'Bank Statement (last 3 months)',
  ssm_form: 'SSM Form',
  site_image_1: 'Site Image 1',
  site_image_2: 'Site Image 2',
  office_image_1: 'Office Image 1',
  office_image_2: 'Office Image 2',
  ic_photocopy: 'IC Photocopy',
};

async function getClientRecord(clientId) {
  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [clientId]);
  return rows[0] || null;
}

function createUploader(clientLoginId) {
  const dir = getClientSubDir(clientLoginId, 'documents');
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const docType = file.fieldname;
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `${docType}_${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
      if (isAllowedUpload(file)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type for ${file.fieldname}`));
      }
    },
  }).fields(REQUIRED_DOC_TYPES.map((type) => ({ name: type, maxCount: 1 })));
}

async function upsertDocument(clientId, docType, filePath, isDraft) {
  const [existing] = await pool.query(
    'SELECT id, file_path FROM uploaded_documents WHERE client_id = ? AND doc_type = ?',
    [clientId, docType]
  );
  if (existing.length > 0) {
    if (existing[0].file_path !== filePath && fs.existsSync(existing[0].file_path)) {
      fs.unlinkSync(existing[0].file_path);
    }
    await pool.query(
      'UPDATE uploaded_documents SET file_path = ?, is_draft = ?, uploaded_at = NOW() WHERE id = ?',
      [filePath, isDraft, existing[0].id]
    );
  } else {
    await pool.query(
      'INSERT INTO uploaded_documents (client_id, doc_type, file_path, is_draft) VALUES (?, ?, ?, ?)',
      [clientId, docType, filePath, isDraft]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const client = await getClientRecord(req.user.id);
    const [rows] = await pool.query(
      'SELECT id, doc_type, file_path, is_draft, uploaded_at FROM uploaded_documents WHERE client_id = ?',
      [req.user.id]
    );
    const docs = rows.map((row) => ({
      ...row,
      label: DOC_LABELS[row.doc_type] || row.doc_type,
      fileName: path.basename(row.file_path),
    }));
    return res.json({
      success: true,
      data: {
        documents: docs,
        required: REQUIRED_DOC_TYPES,
        labels: DOC_LABELS,
        canEdit: clientCanEdit(client.status),
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

    const uploader = createUploader(client.client_login_id);
    uploader(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });

      const uploaded = [];
      for (const docType of REQUIRED_DOC_TYPES) {
        const fileArr = req.files?.[docType];
        if (fileArr && fileArr[0]) {
          await upsertDocument(req.user.id, docType, fileArr[0].path, true);
          uploaded.push(docType);
        }
      }

      const [rows] = await pool.query(
        'SELECT id, doc_type, file_path, is_draft, uploaded_at FROM uploaded_documents WHERE client_id = ?',
        [req.user.id]
      );
      await markDraftStatus(pool, req.user.id);
      return res.json({ success: true, data: { uploaded, documents: rows } });
    });
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

    const uploader = createUploader(client.client_login_id);
    uploader(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });

      for (const docType of REQUIRED_DOC_TYPES) {
        const fileArr = req.files?.[docType];
        if (fileArr && fileArr[0]) {
          await upsertDocument(req.user.id, docType, fileArr[0].path, false);
        }
      }

      const [rows] = await pool.query(
        'SELECT doc_type FROM uploaded_documents WHERE client_id = ?',
        [req.user.id]
      );
      const uploaded = rows.map((r) => r.doc_type);
      const missing = REQUIRED_DOC_TYPES.filter((t) => !uploaded.includes(t));
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required documents: ${missing.join(', ')}`,
        });
      }

      const templateIds = await requiredTemplateIds(pool, req.user.id);
      if (templateIds.length > 0) {
        const [templateUploads] = await pool.query(
          'SELECT template_id FROM template_uploads WHERE client_id = ?',
          [req.user.id]
        );
        const uploadedTemplateIds = templateUploads.map((r) => r.template_id);
        const missingTemplates = templateIds.filter((id) => !uploadedTemplateIds.includes(id));
        if (missingTemplates.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Please upload filled copies of all downloaded templates before submitting.',
          });
        }
      }

      await pool.query(
        'UPDATE uploaded_documents SET is_draft = FALSE WHERE client_id = ?',
        [req.user.id]
      );
      await pool.query(
        'UPDATE template_uploads SET is_draft = FALSE WHERE client_id = ?',
        [req.user.id]
      );
      await checkAndUpdateClientStatus(pool, req.user.id);

      const [updatedDocs] = await pool.query(
        'SELECT id, doc_type, file_path, is_draft, uploaded_at FROM uploaded_documents WHERE client_id = ?',
        [req.user.id]
      );
      return res.json({ success: true, data: updatedDocs });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:docType/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT file_path FROM uploaded_documents WHERE client_id = ? AND doc_type = ?',
      [req.user.id, req.params.docType]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    return sendFile(res, rows[0].file_path);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
