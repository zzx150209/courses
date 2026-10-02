(() => {
  const root = document.documentElement;
  const body = document.body;
  const saved = localStorage.getItem('showball-theme');
  const preferredDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (preferredDark ? 'dark' : 'light');
  root.dataset.theme = initial;

  const syncThemeIcon = () => {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.innerHTML = root.dataset.theme === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
      btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
    });
  };
  document.addEventListener('click', e => {
    const themeBtn = e.target.closest('[data-theme-toggle]');
    if (themeBtn) {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('showball-theme', root.dataset.theme);
      syncThemeIcon();
    }
    if (e.target.closest('[data-menu-toggle]')) body.classList.toggle('nav-open');
    if (e.target.closest('[data-nav-close]') || (e.target.closest('.side-link') && innerWidth <= 820)) body.classList.remove('nav-open');
  });
  syncThemeIcon();

  const page = body.dataset.page;
  document.querySelectorAll('.side-link[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === page));
})();
