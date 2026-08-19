(async function init() {
  await requireRole('admin');
  document.querySelectorAll('.type-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter').forEach((b) => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-primary');
      });
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
      loadClients(btn.dataset.type);
    });
  });
  loadClients('');
})();

async function loadClients(typeFilter) {
  const tbody = document.getElementById('clients-body');
  try {
    const res = await api('/admin/clients');
    let clients = res.data;
    if (typeFilter) {
      clients = clients.filter((c) => c.client_type === typeFilter);
    }
    if (!clients.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted">No clients yet.</td></tr>';
      return;
    }
    tbody.innerHTML = clients.map((c) => `
      <tr>
        <td>${escapeHtml(c.company_name)}</td>
        <td><code>${escapeHtml(c.client_login_id)}</code></td>
        <td>${c.client_type}</td>
        <td>${escapeHtml(c.commercial_mode)}</td>
        <td>${statusBadge(c.onboardingStatus, c.onboardingStatusLabel)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${new Date(c.created_at).toLocaleDateString()}</td>
        <td><a href="/client-portal/admin/clients/${c.id}" class="btn btn-sm btn-outline-primary">View</a></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
