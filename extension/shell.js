// Sidebar touch-ups on every CMS page (Pro mode): real course names, the current page highlighted, no "0" badges.
(() => {
  if (!document.documentElement.classList.contains('cmsv-pro')) return;
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  // Highlight the link for this exact page (the CMS always highlights "Home Page").
  const here = location.pathname.toLowerCase() + location.search.toLowerCase();
  const links = [...sidebar.querySelectorAll('a[href]')];
  const current = links.find((a) => {
    if (a.getAttribute('href').startsWith('#')) return false; // menu group toggles, not pages
    const u = new URL(a.href, location.href);
    return u.pathname.toLowerCase() + u.search.toLowerCase() === here;
  });
  if (current) {
    sidebar.querySelectorAll('a.mm-active').forEach((a) => a.classList.remove('mm-active'));
    current.classList.add('mm-active');
    current.closest('li')?.classList.add('mm-active');
  }

  for (const badge of sidebar.querySelectorAll('.badge')) {
    if (badge.textContent.trim() === '0') badge.hidden = true;
  }

  // "(|MATH501|..." -> "MATH501 · Mathematics V (Discrete Math)", using names the extension has seen.
  chrome.storage.local.get({ courses: {} }).then(({ courses }) => {
    for (const a of sidebar.querySelectorAll('a[href*="CourseViewStn.aspx?id="], a[href*="StnGroupChat.aspx?id="]')) {
      const id = new URL(a.href, location.href).searchParams.get('id');
      const c = courses[id];
      if (!c) continue;
      const text = [...a.childNodes].reverse().find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (!text) continue;
      text.textContent = `${c.code} · ${c.name}`;
      a.title = `${c.code} · ${c.name}`;
      a.classList.add('cmsv-side-course');
    }
  });
})();
