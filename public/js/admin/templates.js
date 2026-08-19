(async function init() {
  await requireRole('admin');
  setupDropzone();
  document.getElementById('upload-form').addEventListener('submit', uploadTemplates);
  loadTemplates();
})();

function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const input = document.getElementById('file-input');
  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    input.files = e.dataTransfer.files;
    renderFileList();
  });
  input.addEventListener('change', renderFileList);
}

function renderFileList() {
  const input = document.getElementById('file-input');
  const el = document.getElementById('file-list');
  if (!input.files.length) {
    el.textContent = 'No files selected.';
    return;
  }
  el.innerHTML = Array.from(input.files).map((f) => escapeHtml(f.name)).join('<br>');
}

async function loadTemplates() {
  const el = document.getElementById('templates-list');
  try {
    const res = await api('/admin/templates');
    if (!res.data.length) {
      el.innerHTML = '<span class="text-muted">No templates uploaded yet.</span>';
      return;
    }
    el.innerHTML = `<table class="table table-sm">
      <thead><tr><th>Type</th><th>File name</th><th>Uploaded</th><th></th></tr></thead>
      <tbody>${res.data.map((t) => `
        <tr>
          <td>${t.client_type}</td>
          <td>${escapeHtml(t.original_filename || t.display_name || '—')}</td>
          <td>${new Date(t.uploaded_at).toLocaleDateString()}</td>
          <td>
            <a href="/client-portal/api/admin/templates/${t.id}/download" class="btn btn-sm btn-outline-primary">Download</a>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate(${t.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    el.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

async function uploadTemplates(e) {
  e.preventDefault();
  const input = document.getElementById('file-input');
  if (!input.files.length) {
    showToast('Please select at least one file', 'danger');
    return;
  }
  const fd = new FormData();
  fd.append('client_type', e.target.client_type.value);
  Array.from(input.files).forEach((file) => fd.append('files', file));
  try {
    await api('/admin/templates', { method: 'POST', body: fd });
    showToast('Templates uploaded');
    e.target.reset();
    renderFileList();
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  try {
    await api(`/admin/templates/${id}`, { method: 'DELETE' });
    showToast('Template deleted');
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.deleteTemplate = deleteTemplate;
