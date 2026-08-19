(async function init() {
  await requireRole('admin');

  const form = document.getElementById('client-form');
  const modalEl = document.getElementById('passwordModal');
  const modal = new bootstrap.Modal(modalEl);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await api('/admin/clients', {
        method: 'POST',
        body: {
          company_name: fd.get('company_name'),
          client_type: fd.get('client_type'),
          commercial_mode: fd.get('commercial_mode'),
        },
      });
      document.getElementById('modal-login-id').textContent = res.data.client.client_login_id;
      document.getElementById('modal-password').textContent = res.data.plaintextPassword;
      modal.show();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  document.getElementById('modal-done').addEventListener('click', () => {
    window.location.href = '/client-portal/admin/dashboard';
  });
})();
