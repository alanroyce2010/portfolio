// Sidebar TOC active-section highlighting
(function () {
  const tocLinks = document.querySelectorAll('.article-toc a');
  if (!tocLinks.length) return;
  const headings = [];
  tocLinks.forEach(link => {
    const id = link.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) headings.push({ el, link });
  });
  window.addEventListener('scroll', () => {
    let current = headings[0];
    for (const h of headings) {
      if (h.el.getBoundingClientRect().top <= 140) current = h;
    }
    tocLinks.forEach(l => l.classList.remove('toc-active'));
    if (current) current.link.classList.add('toc-active');
  }, { passive: true });
})();

// Citation copy button
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.citation-copy');
  if (!btn) return;
  const text = document.getElementById('citation-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
});
