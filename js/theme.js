// Site-wide dark mode toggle
(function () {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;
  const saved = localStorage.getItem('theme');
  document.documentElement.setAttribute('data-theme', saved ?? 'light');
  function updateIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    toggle.innerHTML = isDark ? '&#9788;' : '&#9790;';
  }
  updateIcon();
  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon();
  });
})();
