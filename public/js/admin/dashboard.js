(async function init() {
  const user = await requireRole('admin');
  if (!user) return;
  const adminName = document.getElementById('admin-name');
  const adminInitial = document.getElementById('admin-initial');
  if (adminName) adminName.textContent = user.username || 'Administrator';
  if (adminInitial) adminInitial.textContent = (user.username || 'A').slice(0, 1).toUpperCase();

  document.querySelectorAll('.type-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter').forEach((b) => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-primary');
        b.classList.remove('filter-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
      btn.classList.add('filter-active');
      btn.setAttribute('aria-pressed', 'true');
      loadClients(btn.dataset.type);
    });
  });

  document.getElementById('client-search')?.addEventListener('input', (event) => {
    filterVisibleClients(event.target.value);
  });

  initializeSupportRequests();

  loadClients('');
})();

async function loadClients(typeFilter) {
  const tbody = document.getElementById('clients-body');
  const count = document.getElementById('clients-count');
  try {
    const res = await api('/admin/clients');
    let clients = res.data;
    renderMetrics(res.data);
    if (typeFilter) {
      clients = clients.filter((c) => c.client_type === typeFilter);
    }
    if (count) count.textContent = `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`;
    if (!clients.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-message"><div class="empty-state"><div><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>No clients found</strong><span>Create a client account to begin onboarding.</span></div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = clients.map((c) => `
      <tr>
        <td class="company-cell" data-label="Company">${escapeHtml(c.company_name)}<small>Client ID: ${escapeHtml(c.client_login_id)}</small></td>
        <td data-label="Client ID"><code>${escapeHtml(c.client_login_id)}</code></td>
        <td data-label="Type">Type ${escapeHtml(c.client_type)}</td>
        <td data-label="Commercial mode">${escapeHtml(c.commercial_mode)}</td>
        <td data-label="Onboarding">${statusBadge(c.onboardingStatus, c.onboardingStatusLabel)}</td>
        <td data-label="Status">${statusBadge(c.status)}</td>
        <td data-label="Created">${new Date(c.created_at).toLocaleDateString()}</td>
        <td><a href="/client-portal/admin/clients/${c.id}" class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><span>View</span></a></td>
      </tr>
    `).join('');
    filterVisibleClients(document.getElementById('client-search')?.value || '');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-message"><div class="empty-state"><div><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load clients</strong><span>${escapeHtml(err.message)}</span></div></div></td></tr>`;
  }
}

function renderMetrics(clients) {
  const totals = {
    total: clients.length,
    submitted: clients.filter((client) => client.status === 'submitted').length,
    progress: clients.filter((client) => ['draft', 'pending_onboarding', 'rejected'].includes(client.status)).length,
    approved: clients.filter((client) => client.status === 'approved').length,
  };
  Object.entries(totals).forEach(([key, value]) => {
    const target = document.querySelector(`[data-metric="${key}"]`);
    if (target) target.textContent = value;
  });
}

function filterVisibleClients(query) {
  const normalized = query.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('#clients-body tr').forEach((row) => {
    if (!row.querySelector('.company-cell')) return;
    const matches = !normalized || row.textContent.toLowerCase().includes(normalized);
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  const count = document.getElementById('clients-count');
  if (count) count.textContent = `${visible} ${visible === 1 ? 'client' : 'clients'}`;
}

let selectedSupportRequest = null;
let supportRequestModal;
let resetCredentialsModal;

function requestTypeLabel(type) {
  return type === 'password_reset' ? 'Password reset' : 'General support';
}

function statusLabel(status) {
  return String(status || '').replace(/_/g, ' ');
}

function initializeSupportRequests() {
  const modalElement = document.getElementById('supportRequestModal');
  const credentialsModalElement = document.getElementById('resetCredentialsModal');
  if (!modalElement || !credentialsModalElement) return;

  supportRequestModal = new bootstrap.Modal(modalElement);
  resetCredentialsModal = new bootstrap.Modal(credentialsModalElement);

  document.querySelectorAll('.support-filter').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.support-filter').forEach((filter) => {
        filter.classList.remove('btn-primary', 'filter-active');
        filter.classList.add('btn-outline-primary');
        filter.setAttribute('aria-pressed', 'false');
      });
      button.classList.remove('btn-outline-primary');
      button.classList.add('btn-primary', 'filter-active');
      button.setAttribute('aria-pressed', 'true');
      loadSupportRequests(button.dataset.supportStatus || '');
    });
  });

  document.getElementById('save-support-request').addEventListener('click', saveSupportRequest);
  document.getElementById('support-reset-password').addEventListener('click', resetSupportPassword);
  credentialsModalElement.addEventListener('hidden.bs.modal', () => {
    document.getElementById('reset-modal-company-name').textContent = '—';
    document.getElementById('reset-modal-login-id').textContent = '';
    document.getElementById('reset-modal-password').textContent = '';
  });
  loadSupportRequests('');
}

async function loadSupportRequests(status = '') {
  const tbody = document.getElementById('support-requests-body');
  const count = document.getElementById('support-requests-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="table-message"><span class="loading-line">Loading support requests</span></td></tr>';
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await api(`/admin/support-requests${query}`);
    const requests = response.data || [];
    if (count) count.textContent = `${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`;
    if (!requests.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-message"><div class="empty-state"><div><i class="fa-regular fa-life-ring" aria-hidden="true"></i><strong>No support requests found</strong><span>New requests from the login page will appear here.</span></div></div></td></tr>';
      return;
    }
    tbody.innerHTML = requests.map((request) => `
      <tr>
        <td data-label="Request"><strong>${escapeHtml(requestTypeLabel(request.request_type))}</strong></td>
        <td data-label="Company / account" class="company-cell">${escapeHtml(request.company_name)}<small>Account: ${escapeHtml(request.account_identifier)}</small></td>
        <td data-label="Message"><span class="support-request-message">${escapeHtml(request.message || 'No message provided.')}</span></td>
        <td data-label="Status">${statusBadge(request.status, statusLabel(request.status))}</td>
        <td data-label="Received">${new Date(request.created_at).toLocaleString()}</td>
        <td><button type="button" class="btn btn-sm btn-outline-primary" data-support-request-id="${request.id}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><span>Review</span></button></td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-support-request-id]').forEach((button) => {
      button.addEventListener('click', () => openSupportRequest(button.dataset.supportRequestId, requests));
    });
  } catch (err) {
    if (count) count.textContent = 'Error';
    tbody.innerHTML = `<tr><td colspan="6" class="table-message"><div class="empty-state"><div><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load support requests</strong><span>${escapeHtml(err.message)}</span></div></div></td></tr>`;
  }
}

function openSupportRequest(id, requests) {
  selectedSupportRequest = requests.find((request) => String(request.id) === String(id)) || null;
  if (!selectedSupportRequest) return;
  const request = selectedSupportRequest;
  const matchedClient = request.matched_client_login_id
    ? `${escapeHtml(request.matched_company_name)} (${escapeHtml(request.matched_client_login_id)})`
    : '<span class="support-request-unmatched">No matching client account</span>';
  document.getElementById('support-request-modal-title').textContent = requestTypeLabel(request.request_type);
  document.getElementById('support-request-detail').innerHTML = `
    <dl>
      <dt>Company</dt><dd>${escapeHtml(request.company_name)}</dd>
      <dt>Account identifier</dt><dd>${escapeHtml(request.account_identifier)}</dd>
      <dt>Matched account</dt><dd>${matchedClient}</dd>
      <dt>Received</dt><dd>${new Date(request.created_at).toLocaleString()}</dd>
      <dt>Request</dt><dd>${escapeHtml(requestTypeLabel(request.request_type))}</dd>
    </dl>
    <div><strong class="form-label d-block">Client message</strong><div class="support-request-message-full">${escapeHtml(request.message || 'No message provided.')}</div></div>`;
  document.getElementById('support-request-status').value = request.status;
  document.getElementById('support-request-notes').value = request.admin_notes || '';
  const canReset = request.request_type === 'password_reset'
    && request.client_id
    && !request.password_reset_at
    && !['resolved', 'closed'].includes(request.status);
  document.getElementById('support-reset-password').classList.toggle('d-none', !canReset);
  document.getElementById('support-reset-note').classList.toggle('d-none', !canReset);
  supportRequestModal.show();
}

async function saveSupportRequest() {
  if (!selectedSupportRequest) return;
  const button = document.getElementById('save-support-request');
  button.disabled = true;
  try {
    const response = await api(`/admin/support-requests/${selectedSupportRequest.id}`, {
      method: 'PATCH',
      body: {
        status: document.getElementById('support-request-status').value,
        adminNotes: document.getElementById('support-request-notes').value,
      },
    });
    selectedSupportRequest = response.data;
    supportRequestModal.hide();
    showToast('Support request updated');
    loadSupportRequests(document.querySelector('.support-filter.filter-active')?.dataset.supportStatus || '');
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    button.disabled = false;
  }
}

async function resetSupportPassword() {
  if (!selectedSupportRequest) return;
  if (!window.confirm('Generate a new temporary password? This immediately invalidates the client’s current password.')) return;
  const button = document.getElementById('support-reset-password');
  button.disabled = true;
  try {
    const response = await api(`/admin/support-requests/${selectedSupportRequest.id}/reset-password`, { method: 'POST' });
    const { client, plaintextPassword } = response.data;
    document.getElementById('reset-modal-company-name').textContent = client.companyName;
    document.getElementById('reset-modal-login-id').textContent = client.clientLoginId;
    document.getElementById('reset-modal-password').textContent = plaintextPassword;
    supportRequestModal.hide();
    resetCredentialsModal.show();
    showToast('Temporary password generated. Share it through a secure channel.', 'warning');
    loadSupportRequests(document.querySelector('.support-filter.filter-active')?.dataset.supportStatus || '');
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    button.disabled = false;
  }
}
