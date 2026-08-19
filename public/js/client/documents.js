const DOC_TYPES = [
  'bank_statement', 'ssm_form', 'site_image_1', 'site_image_2',
  'office_image_1', 'office_image_2', 'ic_photocopy',
];

let docLabels = {};
let docsCanEdit = true;

function renderDocSlots(existing = []) {
  const container = document.getElementById('doc-slots');
  const byType = Object.fromEntries(existing.map((d) => [d.doc_type, d]));
  container.innerHTML = DOC_TYPES.map((type) => {
    const doc = byType[type];
    const label = docLabels[type] || type.replace(/_/g, ' ');
    return `<div class="col-md-6">
      <div class="doc-slot ${doc ? 'uploaded' : ''}">
        <label class="form-label">${label}</label>
        <input type="file" class="form-control" name="${type}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
        ${doc ? `<div class="form-text">Current: ${doc.fileName || 'uploaded'} ${doc.is_draft ? '(draft)' : '(submitted)'}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function loadDocuments() {
  try {
    const res = await api('/client/documents');
    docLabels = res.data.labels || {};
    docsCanEdit = res.data.canEdit;
    renderDocSlots(res.data.documents);
    if (!docsCanEdit) {
      document.querySelectorAll('#documents-form input, #documents-form button').forEach((el) => { el.disabled = true; });
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitDocuments(isDraft) {
  const form = document.getElementById('documents-form');
  const fd = new FormData(form);
  const endpoint = isDraft ? '/client/documents/draft' : '/client/documents/submit';
  try {
    await api(endpoint, { method: 'POST', body: fd });
    showToast(isDraft ? 'Documents draft saved' : 'Documents submitted');
    loadDocuments();
    if (window.loadDownloads) window.loadDownloads();
    if (!isDraft && window.refreshStatus) window.refreshStatus();
    if (isDraft && window.refreshStatus) window.refreshStatus();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

document.getElementById('save-docs-draft').addEventListener('click', () => submitDocuments(true));
document.getElementById('documents-form').addEventListener('submit', (e) => {
  e.preventDefault();
  submitDocuments(false);
});

loadDocuments();
