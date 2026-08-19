let canEdit = true;
let signatureSaved = false;
let canvas, ctx, drawing = false;

function initSignaturePad() {
  canvas = document.getElementById('signature-pad');
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
  const move = (e) => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const stop = () => { drawing = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);

  document.getElementById('clear-signature').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signatureSaved = false;
    document.getElementById('signature-status').textContent = 'No signature saved yet.';
  });

  document.getElementById('save-signature').addEventListener('click', saveSignature);
}

async function saveSignature() {
  if (!canEdit) return;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const fd = new FormData();
  fd.append('signature', blob, 'signature.png');
  try {
    await api('/client/onboarding/signature', { method: 'POST', body: fd });
    signatureSaved = true;
    document.getElementById('signature-status').textContent = 'Signature saved.';
    showToast('Signature saved');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function collectFormData() {
  const form = document.getElementById('onboarding-form');
  const fd = new FormData(form);
  const data = {};
  for (const [key, val] of fd.entries()) {
    data[key] = val;
  }
  if (document.getElementById('primaryBank').checked) {
    data.primary_active_bank_account = '1';
  }
  return data;
}

function populateForm(formData) {
  if (!formData) return;
  const form = document.getElementById('onboarding-form');
  for (const [key, val] of Object.entries(formData)) {
    const el = form.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = val === '1' || val === true;
    } else {
      el.value = val;
    }
  }
}

function setFormDisabled(disabled) {
  document.querySelectorAll('#onboarding-form input, #onboarding-form textarea, #onboarding-form select, #onboarding-form button')
    .forEach((el) => { el.disabled = disabled; });
  if (!disabled) {
    document.getElementById('commercial-mode-display').disabled = true;
  }
}

async function loadOnboarding() {
  try {
    const res = await api('/client/onboarding');
    canEdit = res.data.canEdit;
    document.getElementById('commercial-mode-display').value = res.data.commercialMode || '';
    populateForm(res.data.form?.form_data);
    if (res.data.form?.signature_path) {
      signatureSaved = true;
      document.getElementById('signature-status').textContent = 'Signature on file.';
    }
    setFormDisabled(!canEdit);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

document.getElementById('save-draft').addEventListener('click', async () => {
  try {
    await api('/client/onboarding/draft', { method: 'POST', body: { form_data: collectFormData() } });
    showToast('Draft saved');
    if (window.refreshStatus) window.refreshStatus();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!signatureSaved) {
    showToast('Please save your signature before submitting', 'danger');
    return;
  }
  try {
    await api('/client/onboarding/submit', { method: 'POST', body: { form_data: collectFormData() } });
    showToast('Onboarding form submitted');
    if (window.refreshStatus) window.refreshStatus();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

document.getElementById('stamp-input').addEventListener('change', async (e) => {
  if (!canEdit || !e.target.files[0]) return;
  const fd = new FormData();
  fd.append('stamp', e.target.files[0]);
  try {
    await api('/client/onboarding/stamp', { method: 'POST', body: fd });
    document.getElementById('stamp-status').textContent = 'Stamp uploaded.';
    showToast('Stamp uploaded');
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

initSignaturePad();
loadOnboarding();
