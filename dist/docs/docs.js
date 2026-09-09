/* Small enhancements; the documentation and navigation work without JavaScript. */
(() => {
  const copyTimers = new WeakMap();
  const copyLabels = new WeakMap();

  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[data-copy-code]') : null;
    if (!button) return;
    const example = button.closest('.code-example');
    const code = example?.querySelector('pre code');
    if (!code) return;

    if (!copyLabels.has(button)) copyLabels.set(button, button.textContent);
    clearTimeout(copyTimers.get(button));
    let status = example.querySelector('.code-copy-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'code-copy-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      button.insertAdjacentElement('afterend', status);
    }

    try {
      if (!navigator.clipboard?.writeText || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code.textContent || '');
      button.textContent = 'Copied';
      button.dataset.copyState = 'copied';
      status.textContent = 'Code copied to the clipboard.';
    } catch {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C';
        button.textContent = `Selected · ${shortcut}`;
        button.dataset.copyState = 'selected';
        status.textContent = `Clipboard access is unavailable. Code selected; press ${shortcut} to copy it.`;
      } else {
        button.textContent = 'Select code to copy';
        button.dataset.copyState = 'unavailable';
        status.textContent = 'Clipboard access is unavailable. Select and copy the code manually.';
      }
    }

    copyTimers.set(button, setTimeout(() => {
      button.textContent = copyLabels.get(button) || 'Copy code';
      delete button.dataset.copyState;
    }, 4000));
  });

  document.addEventListener('change', (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches('select.docs-system-select, .docs-system-select select') || !select.value) return;
    const destination = new URL(select.value, window.location.href);
    if (destination.origin === window.location.origin && ['http:', 'https:', 'file:'].includes(destination.protocol)) window.location.assign(destination.href);
  });

  const toc = document.querySelector('.docs-toc');
  if (!toc || !('IntersectionObserver' in window)) return;
  const sections = [...toc.querySelectorAll('a[href^="#"]')].map(link => {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return null; }
    const heading = document.getElementById(id);
    return heading ? { link, heading } : null;
  }).filter(Boolean);
  if (!sections.length) return;

  const updateCurrent = () => {
    const threshold = Math.max(100, window.innerHeight * 0.2);
    let active = sections[0];
    for (const section of sections) {
      if (section.heading.getBoundingClientRect().top <= threshold) active = section;
    }
    for (const section of sections) {
      if (section === active) section.link.setAttribute('aria-current', 'location');
      else section.link.removeAttribute('aria-current');
    }
  };
  const observer = new IntersectionObserver(updateCurrent, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
  for (const { heading } of sections) observer.observe(heading);
  window.addEventListener('hashchange', updateCurrent);
  updateCurrent();
})();
