const BASE = '/client-portal';

async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
    body: options.body instanceof FormData
      ? options.body
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !options.skipAuthRedirect) {
      window.location.href = `${BASE}/`;
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'ad-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  const normalizedType = ['danger', 'warning'].includes(type) ? type : 'success';
  const icon = normalizedType === 'danger' ? 'fa-circle-exclamation' : normalizedType === 'warning' ? 'fa-triangle-exclamation' : 'fa-check';
  el.className = `ad-toast toast-${normalizedType}`;
  el.setAttribute('role', normalizedType === 'danger' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="ad-toast-icon" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>
    <div class="ad-toast-copy"></div>
    <button type="button" class="ad-toast-close" aria-label="Dismiss notification"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
  `;
  el.querySelector('.ad-toast-copy').textContent = message;
  el.querySelector('.ad-toast-close').addEventListener('click', () => el.remove());
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function statusBadge(status, label) {
  const text = label || (status || '').replace(/_/g, ' ');
  const safeStatus = String(status || 'pending_onboarding').replace(/[^a-z_]/gi, '').toLowerCase();
  return `<span class="status-badge status-${safeStatus}">${escapeHtml(text)}</span>`;
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = `${BASE}/`;
  }
}

function bindPasswordToggle(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!input || !button) return;
  button.addEventListener('click', () => {
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    button.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    button.textContent = hidden ? 'Hide' : 'View';
  });
}

async function requireRole(role) {
  const me = await api('/auth/me', { skipAuthRedirect: true }).catch(() => null);
  if (!me?.data || me.data.role !== role) {
    window.location.href = `${BASE}/`;
    return null;
  }
  return me.data;
}

async function logout() {
  await api('/auth/logout', { method: 'POST', skipAuthRedirect: true }).catch(() => {});
  window.location.href = `${BASE}/`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
