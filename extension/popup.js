// Deprecated popup script.
// The extension UI is now powered by `assistant.js` (popup.html + sidebar.html).
// This file is kept intentionally minimal to avoid breaking the extension if
// an old HTML file still references `popup.js`.

(() => {
  try {
    // If an old UI loads this file, show a visible hint.
    const existing = document.getElementById('foxy-deprecated-popupjs');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'foxy-deprecated-popupjs';
    banner.style.cssText = [
      'margin: 10px',
      'padding: 10px',
      'border: 1px solid #3f3f46',
      'border-radius: 8px',
      'background: #0f0f0f',
      'color: #e4e4e7',
      'font-size: 12px',
      'line-height: 1.4',
    ].join(';');
    banner.textContent = 'This UI is outdated. Reload the extension; the active UI uses assistant.js.';

    document.body?.prepend(banner);
  } catch {
    // Never break the page.
  }
})();

