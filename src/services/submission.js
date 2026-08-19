const REQUIRED_DOC_TYPES = [
  'bank_statement',
  'ssm_form',
  'site_image_1',
  'site_image_2',
  'office_image_1',
  'office_image_2',
  'ic_photocopy',
];

const EDITABLE_STATUSES = ['pending_onboarding', 'draft', 'rejected'];

async function markDraftStatus(pool, clientId) {
  await pool.query(
    `UPDATE clients SET status = 'draft'
     WHERE id = ? AND status IN ('pending_onboarding', 'draft', 'rejected')`,
    [clientId]
  );
}

async function requiredTemplateIds(pool, clientId) {
  const [clientRows] = await pool.query('SELECT client_type FROM clients WHERE id = ?', [clientId]);
  if (clientRows.length === 0) return [];
  const [templates] = await pool.query(
    'SELECT id FROM templates WHERE client_type = ?',
    [clientRows[0].client_type]
  );
  return templates.map((t) => t.id);
}

async function checkAndUpdateClientStatus(pool, clientId) {
  const [onboardingRows] = await pool.query(
    'SELECT is_draft FROM onboarding_forms WHERE client_id = ? ORDER BY id DESC LIMIT 1',
    [clientId]
  );
  const [docRows] = await pool.query(
    'SELECT doc_type, is_draft FROM uploaded_documents WHERE client_id = ?',
    [clientId]
  );
  const templateIds = await requiredTemplateIds(pool, clientId);
  const [templateUploads] = await pool.query(
    'SELECT template_id, is_draft FROM template_uploads WHERE client_id = ?',
    [clientId]
  );

  const onboardingSubmitted = onboardingRows.length > 0 && onboardingRows[0].is_draft === 0;
  const submittedDocs = docRows.filter((d) => d.is_draft === 0).map((d) => d.doc_type);
  const allDocsSubmitted = REQUIRED_DOC_TYPES.every((type) => submittedDocs.includes(type));
  const uploadedByTemplate = Object.fromEntries(
    templateUploads.map((row) => [row.template_id, row])
  );
  const allTemplatesSubmitted = templateIds.every((id) => uploadedByTemplate[id]?.is_draft === 0);

  if (onboardingSubmitted && allDocsSubmitted && allTemplatesSubmitted) {
    await pool.query(
      `UPDATE clients SET status = 'submitted', rejection_reason = NULL
       WHERE id = ? AND status IN ('pending_onboarding', 'draft', 'rejected')`,
      [clientId]
    );
    return 'submitted';
  }
  return null;
}

function clientCanEdit(status) {
  return EDITABLE_STATUSES.includes(status);
}

function resolveOnboardingStatus(onboarding, clientStatus) {
  if (!onboarding) {
    return { key: 'not_started', label: 'Not started' };
  }
  const isDraft = onboarding.is_draft === 1 || onboarding.is_draft === true;
  if (isDraft) {
    return { key: 'draft', label: 'Draft' };
  }
  if (clientStatus === 'approved') {
    return { key: 'approved', label: 'Approved' };
  }
  if (clientStatus === 'rejected') {
    return { key: 'rejected', label: 'Rejected' };
  }
  return { key: 'pending_approval', label: 'Submitted / Pending approval' };
}

module.exports = {
  REQUIRED_DOC_TYPES,
  checkAndUpdateClientStatus,
  clientCanEdit,
  markDraftStatus,
  requiredTemplateIds,
  resolveOnboardingStatus,
};
