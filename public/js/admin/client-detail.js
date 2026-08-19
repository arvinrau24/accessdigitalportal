const clientId = window.location.pathname.split('/').pop();
let rejectModal;

(async function init() {
  await requireRole('admin');
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
    el.innerHTML = '<span class="text-muted">No onboarding data yet.</span>';
    return;
  }
  el.innerHTML = `<dl class="row mb-0">${Object.entries(formData).map(([key, val]) => `
    <dt class="col-sm-4 text-capitalize">${escapeHtml(key.replace(/_/g, ' '))}</dt>
    <dd class="col-sm-8">${escapeHtml(val)}</dd>
  `).join('')}</dl>`;
}

async function loadDetail() {
  try {
    const res = await api(`/admin/clients/${clientId}`);
    const { client, onboarding, documents, templateUploads, reviewLog } = res.data;

    document.getElementById('company-name').textContent = client.company_name;
    document.getElementById('client-meta').textContent =
      `${client.client_login_id} · Type ${client.client_type} · ${client.commercial_mode}`;
    document.getElementById('status-badge').innerHTML = statusBadge(client.status);
    document.getElementById('rejection-reason').textContent =
      client.rejection_reason ? `Reason: ${client.rejection_reason}` : '';

    setReviewEnabled(client.status === 'submitted');

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
      docsList.innerHTML = '<span class="text-muted">No documents uploaded.</span>';
    } else {
      docsList.innerHTML = `<ul class="list-group">${documents.map((d) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${d.doc_type.replace(/_/g, ' ')} ${d.is_draft ? '(draft)' : '(submitted)'}</span>
          <a href="/client-portal/api/admin/clients/${clientId}/documents/${d.id}/download" class="btn btn-sm btn-outline-primary">Download</a>
        </li>`).join('')}</ul>`;
    }

    const templateEl = document.getElementById('template-uploads-list');
    if (!templateUploads?.length) {
      templateEl.innerHTML = '<span class="text-muted">No filled templates uploaded.</span>';
    } else {
      templateEl.innerHTML = `<ul class="list-group">${templateUploads.map((d) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${escapeHtml(d.template_name || d.original_filename)} ${d.is_draft ? '(draft)' : '(submitted)'}</span>
          <a href="/client-portal/api/admin/clients/${clientId}/template-uploads/${d.id}/download" class="btn btn-sm btn-outline-primary">Download</a>
        </li>`).join('')}</ul>`;
    }

    const reviewEl = document.getElementById('review-log');
    if (!reviewLog.length) {
      reviewEl.innerHTML = '<span class="text-muted">No reviews yet.</span>';
    } else {
      reviewEl.innerHTML = reviewLog.map((r) => `
        <div class="border-bottom py-2">
          <strong>${r.action}</strong> by ${r.admin_username} — ${new Date(r.created_at).toLocaleString()}
          ${r.reason ? `<div class="small text-muted">${escapeHtml(r.reason)}</div>` : ''}
        </div>`).join('');
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  if (!confirm('Delete this client and all uploaded files?')) return;
  try {
    await api(`/admin/clients/${clientId}`, { method: 'DELETE' });
    window.location.href = '/client-portal/admin/dashboard';
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
