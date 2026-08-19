const express = require('express');
const pool = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const { sendFile } = require('../../utils/fileServe');

const router = express.Router();
router.use(requireAdmin);

router.get('/clients/:id/onboarding-pdf', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT generated_pdf_path FROM onboarding_forms WHERE client_id = ? AND generated_pdf_path IS NOT NULL ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );
    if (rows.length === 0 || !rows[0].generated_pdf_path) {
      return res.status(404).json({ success: false, error: 'Generated PDF not found' });
    }
    return sendFile(res, rows[0].generated_pdf_path, 'customer-onboarding-form.pdf');
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/clients/:id/review', async (req, res) => {
  try {
    const { action, reason } = req.body;
    const clientId = req.params.id;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    if (action === 'rejected' && (!reason || !reason.trim())) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const [clientRows] = await pool.query('SELECT id, status FROM clients WHERE id = ?', [clientId]);
    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    if (clientRows[0].status !== 'submitted') {
      return res.status(400).json({
        success: false,
        error: 'Approve or reject is only available after the client submits. Drafts can be viewed only.',
      });
    }

    const newStatus = action === 'approved' ? 'approved' : 'rejected';
    const rejectionReason = action === 'rejected' ? reason.trim() : null;

    await pool.query('UPDATE clients SET status = ?, rejection_reason = ? WHERE id = ?', [
      newStatus,
      rejectionReason,
      clientId,
    ]);
    await pool.query(
      'INSERT INTO review_log (client_id, admin_id, action, reason) VALUES (?, ?, ?, ?)',
      [clientId, req.user.id, action, rejectionReason]
    );

    const [updated] = await pool.query(
      'SELECT id, status, rejection_reason FROM clients WHERE id = ?',
      [clientId]
    );
    return res.json({ success: true, data: updated[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/clients/:id/documents/:docId/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT file_path, doc_type FROM uploaded_documents WHERE id = ? AND client_id = ?',
      [req.params.docId, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    return sendFile(res, rows[0].file_path, `${rows[0].doc_type}${require('path').extname(rows[0].file_path)}`);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/clients/:id/template-uploads/:uploadId/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT tu.file_path, tu.original_filename
       FROM template_uploads tu
       WHERE tu.id = ? AND tu.client_id = ?`,
      [req.params.uploadId, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    return sendFile(
      res,
      rows[0].file_path,
      rows[0].original_filename || require('path').basename(rows[0].file_path)
    );
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
