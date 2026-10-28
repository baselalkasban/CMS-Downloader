// Command palette (Ctrl+K) on every CMS page: jump to courses, pages, weeks and files, or switch theme.
(() => {
  const U = CMSUI;
  const BASE = '/apps/student/';
  const PAGES = [
    { title: 'Home', url: 'HomePageStn.aspx', keywords: 'dashboard start' },
    { title: 'All courses', url: 'ViewAllCourseStn.aspx', keywords: 'old seasons previous semesters' },
    { title: 'Notifications', url: 'AllNotification.aspx', keywords: 'updates activity alerts' },
    { title: 'My issues', url: 'ViewComplaintStn.aspx', keywords: 'complaints reports problems' },
    { title: 'Group chats', url: 'Chat/StnGroupChatlist.aspx', keywords: 'messages discussion' },
  ];
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    course: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
    page: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
    week: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4m6-4v4"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4z"/></svg>',
    theme: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>',
    action: '<svg viewBox="0 0 24 24"><path d="m13 3-8 11h6l-1 7 8-11h-6z"/></svg>',
    recent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  };

  // ---------- Data ----------

  // Courses this student is enrolled in, from the CMS sidebar (id + season id), named from what the extension has seen.
  function sidebarCourses(stored) {
    const found = new Map();
    for (const a of document.querySelectorAll('a[href*="CourseViewStn.aspx?id="]')) {
      const u = new URL(a.href, location.href);
      const id = u.searchParams.get('id');
      if (!id || found.has(id)) continue;
      const known = stored[id];
      const text = a.textContent.replace(/\s+/g, ' ').trim();
      found.set(id, {
        id,
        sid: u.searchParams.get('sid'),
        code: known?.code || (/\|([^|]+)\|/.exec(text) || [])[1] || '',
        name: known?.name || text,
      });
    }
    return [...found.values()];
  }

  const courseUrl = (c, hash = '') => `${BASE}CourseViewStn.aspx?id=${c.id}&sid=${c.sid}${hash}`;

  function go(url) {
    const target = new URL(url, location.href);
    if (target.pathname === location.pathname && target.search === location.search && target.hash) {
      location.hash = target.hash; // same course page: let it react to the hash without reloading
    } else {
      location.href = target.href;
    }
  }

  async function buildEntries() {
    const [{ courses = {}, index = {}, recent = [] }, { theme }] = await Promise.all([
      chrome.storage.local.get(['courses', 'index', 'recent']),
      chrome.storage.sync.get({ theme: document.documentElement.dataset.cmsvTheme }),
    ]);
    const enrolled = sidebarCourses(courses);
    const entries = [];

    for (const r of recent.slice(0, 8)) {
      const c = enrolled.find((x) => x.id === r.courseId) || { id: r.courseId, sid: r.sid, code: r.code };
      entries.push({
        group: 'Recent', icon: 'recent', title: r.title, sub: [c.code, r.type].filter(Boolean).join(' · '),
        recentOnly: true, run: () => go(courseUrl(c, `#cmsv-file=${r.fileId}`)),
      });
    }
    for (const c of enrolled) {
      entries.push({ group: 'Courses', icon: 'course', title: c.name, sub: c.code, keywords: 'course', run: () => go(courseUrl(c)) });
    }
    for (const p of PAGES) {
      entries.push({ group: 'Pages', icon: 'page', title: p.title, sub: 'CMS page', keywords: p.keywords, run: () => go(BASE + p.url) });
    }
    for (const c of enrolled) {
      entries.push({
        group: 'Pages', icon: 'chat', title: `Group chat · ${c.name}`, sub: c.code, keywords: 'chat messages',
        run: () => go(`${BASE}Chat/StnGroupChat.aspx?id=${c.id}&sid=${c.sid}`),
      });
    }
    for (const c of enrolled) {
      const data = index[c.id];
      if (!data) continue;
      for (const w of data.weeks) {
        entries.push({
          group: 'Weeks', icon: 'week', title: `${w.name}${w.topic ? ` · ${w.topic}` : ''}`,
          sub: [c.code, w.date && U.fmtDate(new Date(w.date)), w.tag].filter(Boolean).join(' · '),
          searchOnly: true, run: () => go(courseUrl(c, `#cmsv-week=${w.idx}`)),
        });
      }
      for (const f of data.files) {
        entries.push({
          group: 'Files', icon: 'file', ext: f.ext, title: f.title, sub: [c.code, f.type, f.week].filter(Boolean).join(' · '),
          keywords: c.name, searchOnly: true, run: () => go(courseUrl(c, `#cmsv-file=${f.id}`)),
        });
      }
    }
    for (const t of CMSThemes) {
      entries.push({
        group: 'Themes', icon: 'theme', title: `Theme: ${t.name}`, sub: t.description, current: t.id === theme,
        swatch: t.swatch, keywords: `theme color ${t.dark ? 'dark' : 'light'} mode appearance`, searchOnly: true,
        run: () => chrome.storage.sync.set({ theme: t.id }),
      });
    }
    const pro = U.getMode() === 'pro';
    entries.push(
      { group: 'Actions', icon: 'action', title: pro ? 'Switch to Classic view' : 'Switch to Pro view', sub: 'Layout', keywords: 'original layout redesign', run: () => U.setMode(pro ? 'classic' : 'pro') },
      { group: 'Actions', icon: 'action', title: 'Keyboard shortcuts', sub: 'Help', keywords: 'keys help', run: () => showShortcuts() }
    );
    const indexed = enrolled.filter((c) => index[c.id]).length;
    return { entries, hint: indexed < enrolled.length ? `Open a course once to make its files searchable (${indexed}/${enrolled.length} indexed).` : '' };
  }

  // ---------- Matching ----------

  // Every word must appear; matches at the start of the title or of a word rank higher.
  function score(entry, words) {
    const title = entry.title.toLowerCase();
    const hay = `${title} ${entry.sub || ''} ${entry.keywords || ''}`.toLowerCase();
    let s = 0;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i < 0) return -1;
      const t = title.indexOf(w);
      s += t === 0 ? 6 : t > 0 && /[^a-z0-9]/.test(title[t - 1]) ? 4 : t > 0 ? 2 : 1;
    }
    return s;
  }

  const GROUPS = ['Recent', 'Courses', 'Pages', 'Weeks', 'Files', 'Themes', 'Actions'];
  const LIMITS = { Files: 25, Weeks: 10 };

  function search(all, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const pool = all.filter((e) => (words.length ? !e.recentOnly : !e.searchOnly));
    const scored = words.length ? pool.map((e) => [e, score(e, words)]).filter(([, s]) => s >= 0) : pool.map((e) => [e, 0]);
    const out = [];
    for (const g of GROUPS) {
      const inGroup = scored.filter(([e]) => e.group === g).sort((a, b) => b[1] - a[1]);
      out.push(...inGroup.slice(0, LIMITS[g] || 12).map(([e]) => e));
    }
    return out;
  }

  // ---------- UI ----------

  const overlay = document.createElement('div');
  overlay.className = 'cmsv cmsv-palette';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="cmsv-palette-backdrop" data-close></div>
    <div class="cmsv-palette-box" role="dialog" aria-modal="true" aria-label="Search the CMS">
      <label class="cmsv-palette-input">${ICON.search}<input type="text" placeholder="Search courses, weeks, files, pages…" aria-label="Search" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></label>
      <div class="cmsv-palette-list" role="listbox"></div>
      <div class="cmsv-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span class="cmsv-palette-hint"></span></div>
    </div>`;
  const input = overlay.querySelector('input');
  const list = overlay.querySelector('.cmsv-palette-list');
  let all = [];
  let shown = [];
  let active = 0;

  function iconHtml(e) {
    if (e.swatch) return `<span class="cmsv-pal-swatch">${e.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
    if (e.icon === 'file') return `<span class="cmsv-pal-ext">${U.esc((e.ext || 'file').toUpperCase().slice(0, 4))}</span>`;
    return `<span class="cmsv-pal-icon">${ICON[e.icon] || ''}</span>`;
  }

  function render() {
    shown = search(all, input.value);
    active = Math.min(active, Math.max(shown.length - 1, 0));
    let html = '';
    let group = '';
    shown.forEach((e, i) => {
      if (e.group !== group) {
        group = e.group;
        html += `<div class="cmsv-pal-group">${U.esc(group)}</div>`;
      }
      html += `<div class="cmsv-pal-item${i === active ? ' is-active' : ''}" role="option" data-i="${i}">
        ${iconHtml(e)}
        <span class="cmsv-pal-text"><span class="cmsv-pal-title">${U.esc(e.title)}</span>${e.sub ? `<span class="cmsv-pal-sub">${U.esc(e.sub)}</span>` : ''}</span>
        ${e.current ? '<span class="cmsv-pal-badge">Current</span>' : ''}
      </div>`;
    });
    list.innerHTML = html || '<div class="cmsv-pal-empty">No matches.</div>';
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function move(d) {
    if (!shown.length) return;
    active = (active + d + shown.length) % shown.length;
    list.querySelectorAll('.cmsv-pal-item').forEach((el) => el.classList.toggle('is-active', +el.dataset.i === active));
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function runActive(i = active) {
    const e = shown[i];
    if (!e) return;
    close();
    e.run();
  }

  async function open(query = '') {
    if (!overlay.isConnected) document.body.appendChild(overlay);
    const { entries, hint } = await buildEntries();
    all = entries;
    overlay.querySelector('.cmsv-palette-hint').textContent = hint;
    overlay.hidden = false;
    input.value = query;
    active = 0;
    render();
    input.focus();
  }

  function close() {
    overlay.hidden = true;
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Enter') runActive();
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  list.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.cmsv-pal-item');
    if (item && +item.dataset.i !== active) {
      active = +item.dataset.i;
      list.querySelectorAll('.cmsv-pal-item').forEach((el) => el.classList.toggle('is-active', el === item));
    }
  });
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.cmsv-pal-item');
    if (item) runActive(+item.dataset.i);
  });
  overlay.addEventListener('click', (e) => e.target.matches('[data-close]') && close());

  // ---------- Keyboard shortcuts help ----------

  const SHORTCUTS = [
    ['Ctrl K', 'Search everything (courses, weeks, files, pages)'],
    ['/', 'Search files on a course page'],
    ['J / K', 'Next / previous week on a course page'],
    ['← / →', 'Previous / next file in a preview'],
    ['Esc', 'Close a preview or this window'],
    ['?', 'Show these shortcuts'],
  ];
  const help = document.createElement('div');
  help.className = 'cmsv cmsv-palette cmsv-help';
  help.hidden = true;
  help.innerHTML = `
    <div class="cmsv-palette-backdrop" data-close></div>
    <div class="cmsv-palette-box">
      <div class="cmsv-help-head"><h3>Keyboard shortcuts</h3><button type="button" class="cmsv-icon-btn" data-close aria-label="Close">✕</button></div>
      <ul class="cmsv-help-list">${SHORTCUTS.map(([k, d]) => `<li><span>${U.esc(d)}</span><span>${k.split(' / ').map((x) => `<kbd>${U.esc(x)}</kbd>`).join(' / ')}</span></li>`).join('')}</ul>
    </div>`;
  help.addEventListener('click', (e) => e.target.closest('[data-close]') && (help.hidden = true));
  function showShortcuts() {
    if (!help.isConnected) document.body.appendChild(help);
    help.hidden = false;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        return overlay.hidden ? open() : close();
      }
      const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (e.key === 'Escape' && !help.hidden) help.hidden = true;
      else if (e.key === '?' && !typing && overlay.hidden) showShortcuts();
    },
    true
  );

  // A search button in the CMS header (Pro mode).
  const header = document.querySelector('.app-header-right') || document.querySelector('.app-header__content');
  if (header && document.documentElement.classList.contains('cmsv-pro')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmsv cmsv-cmdk';
    btn.innerHTML = `${ICON.search}<span>Search CMS…</span><kbd>Ctrl K</kbd>`;
    btn.addEventListener('click', () => open());
    header.prepend(btn);
  }

  window.CMSPalette = { open, showShortcuts };
})();
