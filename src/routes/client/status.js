const express = require('express');
const pool = require('../../db');
const { requireClient } = require('../../middleware/auth');
const { clientCanEdit, REQUIRED_DOC_TYPES, requiredTemplateIds, resolveOnboardingStatus } = require('../../services/submission');

const router = express.Router();
router.use(requireClient);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, status, rejection_reason, commercial_mode, company_name FROM clients WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const client = rows[0];
    const [onboarding] = await pool.query(
      'SELECT is_draft, submitted_at FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    const [docs] = await pool.query(
      'SELECT doc_type, is_draft FROM uploaded_documents WHERE client_id = ?',
      [req.user.id]
    );
    const templateIds = await requiredTemplateIds(pool, req.user.id);
    const [templateUploads] = await pool.query(
      'SELECT is_draft FROM template_uploads WHERE client_id = ?',
      [req.user.id]
    );

    const submittedDocs = docs.filter((d) => d.is_draft === 0).length;
    const submittedTemplates = templateUploads.filter((d) => d.is_draft === 0).length;
    const totalDocuments = REQUIRED_DOC_TYPES.length + templateIds.length;

    const onboardingStatus = resolveOnboardingStatus(onboarding[0], client.status);

    return res.json({
      success: true,
      data: {
        status: client.status,
        rejectionReason: client.rejection_reason,
        canEdit: clientCanEdit(client.status),
        onboardingStatus: onboardingStatus.key,
        onboardingStatusLabel: onboardingStatus.label,
        documentsSubmitted: submittedDocs + submittedTemplates,
        totalDocuments,
        companyName: client.company_name,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
