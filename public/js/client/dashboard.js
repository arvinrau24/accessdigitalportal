(async function init() {
  const user = await requireRole('client');
  document.getElementById('nav-company').textContent = user.companyName || 'Client Dashboard';
  loadDownloads();
  refreshStatus();
})();

async function loadDownloads() {
  const el = document.getElementById('downloads-list');
  try {
    const res = await api('/client/templates');
    const templates = res.data;
    const canEdit = res.canEdit;
    if (!templates.length) {
      el.innerHTML = '<span class="text-muted">No templates available yet. Contact admin.</span>';
      return;
    }
    el.innerHTML = templates.map((t) => {
      const filled = t.filled;
      return `
      <div class="border rounded p-3 mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>${escapeHtml(t.displayName)}</strong>
          <a href="/client-portal/api/client/templates/${t.id}/download" class="btn btn-sm btn-outline-primary">Download</a>
        </div>
        <label class="form-label small mb-1">Upload filled copy</label>
        <input type="file" class="form-control" ${canEdit ? '' : 'disabled'}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onchange="uploadFilledTemplate(${t.id}, this)">
        ${filled ? `<div class="form-text">Current: ${escapeHtml(filled.original_filename)} ${filled.is_draft ? '(draft)' : '(submitted)'}</div>` : ''}
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

async function uploadFilledTemplate(templateId, input) {
  if (!input.files[0]) return;
  const fd = new FormData();
  fd.append('file', input.files[0]);
  try {
    await api(`/client/templates/${templateId}/upload`, { method: 'POST', body: fd });
    showToast('Filled template uploaded');
    loadDownloads();
    if (window.refreshStatus) window.refreshStatus();
  } catch (err) {
    showToast(err.message, 'danger');
    input.value = '';
  }
}

async function refreshStatus() {
  const el = document.getElementById('status-content');
  try {
    const res = await api('/client/status');
    const s = res.data;
    el.innerHTML = `
      <div class="mb-3">${statusBadge(s.status)}</div>
      <ul class="list-unstyled mb-3">
        <li>Onboarding form: ${s.onboardingStatus}</li>
        <li>Documents: ${s.documentsSubmitted} / ${s.totalDocuments} submitted</li>
      </ul>
      ${s.rejectionReason ? `<div class="alert alert-danger">Rejection reason: ${escapeHtml(s.rejectionReason)}</div>` : ''}
      ${s.canEdit ? '<p class="text-muted mb-0">You can edit and resubmit your forms.</p>' : '<p class="text-muted mb-0">Your submission is locked pending review.</p>'}
    `;
  } catch (err) {
    el.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.refreshStatus = refreshStatus;
window.uploadFilledTemplate = uploadFilledTemplate;
window.loadDownloads = loadDownloads;
