// Shared helpers for the redesigned CMS pages.
var CMSUI = (() => {
  const MODE_KEY = 'cmsv:mode';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // "LAB MANUAL" / "lab manual" -> "Lab Manual"; keeps mixed-case words such as "VoD".
  const titleCase = (s) =>
    String(s || '')
      .trim()
      .split(/\s+/)
      .map((w) =>
        w === w.toLowerCase() || w === w.toUpperCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
      )
      .join(' ');

  function getMode() {
    try {
      return localStorage.getItem(MODE_KEY) || 'pro';
    } catch {
      return 'pro';
    }
  }

  function setMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
    location.reload();
  }

  // Small pill shown in the classic layout to switch back to the redesigned one.
  function addProSwitch() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmsv-switch';
    btn.textContent = '✦ Pro view';
    btn.title = 'Switch to the redesigned layout';
    btn.addEventListener('click', () => setMode('pro'));
    document.body.appendChild(btn);
  }

  let toastTimer;
  function toast(text, ms = 2500) {
    let el = document.querySelector('.cmsv-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cmsv cmsv-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  const parseDate = (s) => {
    const m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };

  const fmtDate = (d, opts = { month: 'short', day: 'numeric' }) => (d ? d.toLocaleDateString(undefined, opts) : '');

  return { esc, titleCase, getMode, setMode, addProSwitch, toast, parseDate, fmtDate };
})();
