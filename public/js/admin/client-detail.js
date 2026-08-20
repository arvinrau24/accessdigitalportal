const clientId = window.location.pathname.split('/').pop();
let rejectModal;

(async function init() {
  const user = await requireRole('admin');
  if (!user) return;
  document.getElementById('admin-name').textContent = user.username || 'Administrator';
  document.getElementById('admin-initial').textContent = (user.username || 'A').slice(0, 1).toUpperCase();
  rejectModal = new bootstrap.Modal(document.getElementById('rejectModal'));
  document.getElementById('btn-approve').addEventListener('click', () => review('approved'));
  document.getElementById('btn-reject').addEventListener('click', () => rejectModal.show());
  document.getElementById('confirm-reject').addEventListener('click', confirmReject);
  document.getElementById('btn-delete').addEventListener('click', deleteClient);
  loadDetail();
})();

function setReviewEnabled(enabled) {
  document.getElementById('btn-approve').disabled = !enabled;
  document.getElementById('btn-reject').disabled = !enabled;
}

function renderFormData(formData) {
  const el = document.getElementById('onboarding-fields');
  if (!formData || !Object.keys(formData).length) {
    el.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-clipboard" aria-hidden="true"></i><strong>No onboarding data yet</strong><span>This client has not saved the form.</span></div></div>';
    return;
  }
  el.innerHTML = `<dl class="row info-list mb-0">${Object.entries(formData).map(([key, val]) => `
    <dt class="col-sm-4">${escapeHtml(key.replace(/_/g, ' '))}</dt>
    <dd class="col-sm-8">${escapeHtml(val)}</dd>
  `).join('')}</dl>`;
}

async function loadDetail() {
  try {
    const res = await api(`/admin/clients/${clientId}`);
    const { client, onboarding, documents, templateUploads, reviewLog } = res.data;

    document.getElementById('company-name').textContent = client.company_name;
    document.getElementById('client-id').textContent = client.client_login_id;
    document.getElementById('client-type').textContent = `Type ${client.client_type}`;
    document.getElementById('client-mode').textContent = client.commercial_mode;
    document.getElementById('status-badge').innerHTML = statusBadge(client.status);
    const rejectionReason = document.getElementById('rejection-reason');
    rejectionReason.textContent = client.rejection_reason ? `Revision request: ${client.rejection_reason}` : '';
    rejectionReason.classList.toggle('d-none', !client.rejection_reason);

    setReviewEnabled(client.status === 'submitted');
    document.getElementById('review-hint').textContent = client.status === 'submitted'
      ? 'This submission is ready for your review.'
      : 'Approval actions become available when the client submits all required materials.';

    const pdfLink = document.getElementById('pdf-link');
    if (onboarding?.generated_pdf_path) {
      pdfLink.href = `/client-portal/api/admin/clients/${clientId}/onboarding-pdf`;
      pdfLink.classList.remove('disabled');
    } else {
      pdfLink.href = '#';
      pdfLink.classList.add('disabled');
    }
    renderFormData(onboarding?.form_data);

    const docsList = document.getElementById('docs-list');
    if (!documents.length) {
      docsList.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>No documents uploaded</strong><span>Files will appear here when the client saves them.</span></div></div>';
    } else {
      docsList.innerHTML = `<div class="resource-list">${documents.map((d) => `
        <div class="resource-row">
          <div class="resource-row-title">${escapeHtml(d.doc_type.replace(/_/g, ' '))}<small>${d.is_draft ? 'Saved as draft' : 'Submitted'} · ${new Date(d.uploaded_at).toLocaleDateString()}</small></div>
          <a href="/client-portal/api/admin/clients/${clientId}/documents/${d.id}/download" class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-download" aria-hidden="true"></i><span>Download</span></a>
        </div>`).join('')}</div>`;
    }

    const templateEl = document.getElementById('template-uploads-list');
    if (!templateUploads?.length) {
      templateEl.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-file-lines" aria-hidden="true"></i><strong>No completed forms yet</strong><span>Filled template files will appear here.</span></div></div>';
    } else {
      templateEl.innerHTML = `<div class="resource-list">${templateUploads.map((d) => `
        <div class="resource-row">
          <div class="resource-row-title">${escapeHtml(d.template_name || d.original_filename)}<small>${d.is_draft ? 'Saved as draft' : 'Submitted'} · ${new Date(d.uploaded_at).toLocaleDateString()}</small></div>
          <a href="/client-portal/api/admin/clients/${clientId}/template-uploads/${d.id}/download" class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-download" aria-hidden="true"></i><span>Download</span></a>
        </div>`).join('')}</div>`;
    }

    const reviewEl = document.getElementById('review-log');
    if (!reviewLog.length) {
      reviewEl.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-clock" aria-hidden="true"></i><strong>No review activity</strong><span>Approval and rejection actions are recorded here.</span></div></div>';
    } else {
      reviewEl.innerHTML = reviewLog.map((r) => `
        <div class="review-entry">
          <strong>${escapeHtml(r.action)} by ${escapeHtml(r.admin_username)}</strong>
          <time>${new Date(r.created_at).toLocaleString()}</time>
          ${r.reason ? `<div class="small text-muted mt-2">${escapeHtml(r.reason)}</div>` : ''}
        </div>`).join('');
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function review(action, reason) {
  try {
    await api(`/admin/clients/${clientId}/review`, {
      method: 'POST',
      body: { action, reason },
    });
    showToast(`Client ${action}`);
    loadDetail();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function confirmReject() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) {
    showToast('Rejection reason is required', 'danger');
    return;
  }
  rejectModal.hide();
  await review('rejected', reason);
}

async function deleteClient() {
  if (!confirm('Delete this client and all uploaded files? This irreversible action cannot be undone.')) return;
  try {
    await api(`/admin/clients/${clientId}`, { method: 'DELETE' });
    window.location.href = '/client-portal/admin/dashboard';
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
