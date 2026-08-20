(async function init() {
  const user = await requireRole('admin');
  if (!user) return;
  document.getElementById('admin-name').textContent = user.username || 'Administrator';
  document.getElementById('admin-initial').textContent = (user.username || 'A').slice(0, 1).toUpperCase();
  setupDropzone();
  document.getElementById('upload-form').addEventListener('submit', uploadTemplates);
  loadTemplates();
})();

function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const input = document.getElementById('file-input');
  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
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
    el.classList.remove('has-files');
    return;
  }
  el.innerHTML = Array.from(input.files).map((f) => `<div><i class="fa-solid fa-file" aria-hidden="true"></i> ${escapeHtml(f.name)}</div>`).join('');
  el.classList.add('has-files');
}

async function loadTemplates() {
  const el = document.getElementById('templates-list');
  try {
    const res = await api('/admin/templates');
    if (!res.data.length) {
      el.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>No templates yet</strong><span>Upload files to make them available to the relevant client type.</span></div></div>';
      return;
    }
    el.innerHTML = `<div class="table-responsive"><table class="table responsive-table">
      <thead><tr><th>Client type</th><th>File name</th><th>Uploaded</th><th></th></tr></thead>
      <tbody>${res.data.map((t) => `
        <tr>
          <td data-label="Client type">Type ${t.client_type}</td>
          <td class="company-cell" data-label="File name">${escapeHtml(t.original_filename || t.display_name || '—')}</td>
          <td data-label="Uploaded">${new Date(t.uploaded_at).toLocaleDateString()}</td>
          <td>
            <div class="d-flex flex-wrap gap-2 justify-content-end">
              <a href="/client-portal/api/admin/templates/${t.id}/download" class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-download" aria-hidden="true"></i><span>Download</span></a>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate(${t.id})"><i class="fa-solid fa-trash" aria-hidden="true"></i><span>Delete</span></button>
            </div>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load templates</strong><span>${escapeHtml(err.message)}</span></div></div>`;
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
  if (!confirm('Delete this template? Existing client upload records for this file will also be removed.')) return;
  try {
    await api(`/admin/templates/${id}`, { method: 'DELETE' });
    showToast('Template deleted');
    loadTemplates();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

window.deleteTemplate = deleteTemplate;
