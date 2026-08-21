(async function init() {
  const user = await requireRole('client');
  if (!user) return;
  document.getElementById('nav-company').textContent = user.companyName || 'Client Dashboard';
  document.getElementById('client-company-name').textContent = user.companyName || 'Your company';
  document.getElementById('client-initial').textContent = (user.companyName || 'C').slice(0, 1).toUpperCase();
  
  // Initialize sidebar navigation to work with Bootstrap tabs
  initializeSidebarNavigation();
  
  loadDownloads();
  refreshStatus();
})();

/**
 * Make sidebar navigation buttons work with Bootstrap tabs
 */
function initializeSidebarNavigation() {
  const sidebarButtons = document.querySelectorAll('.portal-nav-link[data-bs-toggle="tab"]');
  const mainTabs = document.querySelectorAll('.portal-tabs button[data-bs-toggle="tab"]');
  
  sidebarButtons.forEach(sidebarBtn => {
    sidebarBtn.addEventListener('click', function(e) {
      const targetId = this.getAttribute('data-bs-target');
      
      // Find matching main tab and trigger Bootstrap tab
      const matchingTab = Array.from(mainTabs).find(tab => 
        tab.getAttribute('data-bs-target') === targetId
      );
      
      if (matchingTab) {
        // Use Bootstrap Tab API to switch tabs
        const bsTab = new bootstrap.Tab(matchingTab);
        bsTab.show();
      }
      
      // Update sidebar active states
      sidebarButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Update aria-selected attributes
      sidebarButtons.forEach(btn => btn.setAttribute('aria-selected', 'false'));
      this.setAttribute('aria-selected', 'true');
    });
  });
  
  // Sync main tabs back to sidebar when main tabs are clicked
  mainTabs.forEach(mainTab => {
    mainTab.addEventListener('shown.bs.tab', function(e) {
      const targetId = this.getAttribute('data-bs-target');
      const matchingSidebarBtn = Array.from(sidebarButtons).find(btn => 
        btn.getAttribute('data-bs-target') === targetId
      );
      
      if (matchingSidebarBtn) {
        sidebarButtons.forEach(btn => btn.classList.remove('active'));
        matchingSidebarBtn.classList.add('active');
        
        sidebarButtons.forEach(btn => btn.setAttribute('aria-selected', 'false'));
        matchingSidebarBtn.setAttribute('aria-selected', 'true');
      }
    });
  });
}


async function loadDownloads() {
  const el = document.getElementById('downloads-list');
  try {
    const res = await api('/client/templates');
    const templates = res.data;
    const canEdit = res.canEdit;
    if (!templates.length) {
      el.innerHTML = '<div class="empty-state"><div><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>No forms available yet</strong><span>Your account manager will add the forms required for your account.</span></div></div>';
      return;
    }
    el.innerHTML = templates.map((t) => {
      const filled = t.filled;
      return `
      <div class="template-item ${filled ? 'is-uploaded' : ''}">
        <div class="template-item-icon"><i class="fa-regular fa-file-lines" aria-hidden="true"></i></div>
        <div class="template-item-content">
          <strong class="template-item-title">${escapeHtml(t.displayName)}</strong>
          <div class="template-item-meta">${filled ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> A file is saved for this form' : 'Download, complete, then upload your filled copy.'}</div>
          <div class="template-item-actions">
            <a href="/client-portal/api/client/templates/${t.id}/download" class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-download" aria-hidden="true"></i><span>Download</span></a>
          </div>
          <label class="form-label small mb-1 mt-3" for="template-upload-${t.id}">Upload completed copy</label>
          <input id="template-upload-${t.id}" type="file" class="form-control" ${canEdit ? '' : 'disabled'}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onchange="uploadFilledTemplate(${t.id}, this)">
          ${filled ? `<div class="upload-state"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Current file: ${escapeHtml(filled.original_filename)} ${filled.is_draft ? '(draft)' : '(submitted)'}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load forms</strong><span>${escapeHtml(err.message)}</span></div></div>`;
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
    const percent = s.totalDocuments ? Math.round((s.documentsSubmitted / s.totalDocuments) * 100) : 0;
    const progressBar = document.getElementById('submission-progress-bar');
    const progressCount = document.getElementById('submission-progress-count');
    const progressDescription = document.getElementById('submission-progress-description');
    if (progressBar) {
      requestAnimationFrame(() => { progressBar.style.width = `${percent}%`; });
      progressBar.setAttribute('aria-valuenow', String(percent));
    }
    if (progressCount) progressCount.textContent = `${percent}% complete`;
    if (progressDescription) progressDescription.textContent = `${s.documentsSubmitted} of ${s.totalDocuments} required documents saved or submitted`;
    el.innerHTML = `
      <div>${statusBadge(s.status)}</div>
      <div class="status-overview">
        <div class="status-detail"><span>Onboarding form</span><strong>${escapeHtml(s.onboardingStatusLabel || s.onboardingStatus)}</strong></div>
        <div class="status-detail"><span>Supporting documents</span><strong>${s.documentsSubmitted} / ${s.totalDocuments} submitted</strong></div>
      </div>
      ${s.rejectionReason ? `<div class="form-note" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span><strong>Revision requested</strong><br>${escapeHtml(s.rejectionReason)}</span></div>` : ''}
      <p class="text-muted mb-0 small">${s.canEdit ? 'Your workspace is open. Save your progress anytime, then submit when every required item is ready.' : 'Your submission is locked while it is being reviewed. You will be notified if changes are needed.'}</p>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>Unable to load status</strong><span>${escapeHtml(err.message)}</span></div></div>`;
  }
}

window.refreshStatus = refreshStatus;
window.uploadFilledTemplate = uploadFilledTemplate;
window.loadDownloads = loadDownloads;
