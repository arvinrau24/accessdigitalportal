(() => {
  const body = document.body;
  const toggle = document.querySelector('[data-sidebar-toggle]');
  const backdrop = document.querySelector('[data-sidebar-backdrop]');
  const sidebar = document.querySelector('.portal-sidebar');

  function closeSidebar() {
    body.classList.remove('portal-sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    const isOpen = body.classList.toggle('portal-sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  }

  if (toggle) toggle.addEventListener('click', toggleSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });

  if (sidebar) {
    sidebar.querySelectorAll('a, button').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 991.98px)').matches) closeSidebar();
      });
    });
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('[data-reveal]');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    revealItems.forEach((item) => observer.observe(item));
  }

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((link) => {
    link.addEventListener('shown.bs.tab', (event) => {
      const target = event.target.dataset.bsTarget;
      document.querySelectorAll('[data-bs-toggle="tab"]').forEach((item) => {
        const isActive = item.dataset.bsTarget === target;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
    });
  });
})();