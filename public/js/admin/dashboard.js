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
