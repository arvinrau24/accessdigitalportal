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
      const isAdminPage = window.location.pathname.includes('/admin/');
      window.location.href = isAdminPage
        ? `${BASE}/admin/login`
        : `${BASE}/client/login`;
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
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0 show`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function statusBadge(status, label) {
  const map = {
    pending_onboarding: 'secondary',
    not_started: 'secondary',
    draft: 'info',
    submitted: 'warning',
    pending_approval: 'warning',
    approved: 'success',
    rejected: 'danger',
  };
  const text = label || (status || '').replace(/_/g, ' ');
  return `<span class="badge text-bg-${map[status] || 'secondary'}">${text}</span>`;
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
    window.location.href = role === 'admin'
      ? `${BASE}/admin/login`
      : `${BASE}/client/login`;
    return null;
  }
  return me.data;
}

async function logout() {
  await api('/auth/logout', { method: 'POST', skipAuthRedirect: true }).catch(() => {});
  window.location.href = `${BASE}/`;
}
