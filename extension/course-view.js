// Redesigned course page: week navigator, compact file list, search and filters.
(() => {
  const U = CMSUI;
  const weekCards = [...document.querySelectorAll('.weeksdata')];
  const pageRoot = document.querySelector('.app-main__inner');
  if (!weekCards.length || !pageRoot) return;

  if (U.getMode() !== 'pro') {
    U.addProSwitch();
    return;
  }

  // ---------- Read the original page ----------

  const course = N_parseCourse(document.querySelector('[id$="LabelCourseName"]')?.textContent);
  const season = document.querySelector('[id$="LabelseasonName"]')?.textContent.trim() || '';
  const studentId = document.getElementById('HiddenFieldstaffid')?.value || '';
  const courseDesc = document.querySelector('[id$="_desc"]');

  function N_parseCourse(text) {
    const m = /\(\|\s*([^|()]+?)\s*\|\)\s*([^\n]+?)\s*\((\d+)\)/.exec(text || '');
    return m ? { code: m[1].trim(), name: m[2].trim() } : { code: '', name: (text || 'Course').trim() };
  }

  // Text of the <p> following a bold label such as "Description" or "Announcement".
  function labelled(card, label) {
    const strong = [...card.querySelectorAll('strong')].find((s) => s.textContent.trim() === label);
    const box = strong?.closest('div')?.parentElement;
    if (!box || box.style.display === 'none') return '';
    return box.querySelector('p')?.textContent.trim() || '';
  }

  const weeks = weekCards.map((card, index) => {
    const heading = card.querySelector('h2')?.textContent || '';
    const date = U.parseDate(heading);
    const tagText = card.querySelector('.menu-header-title.text-right')?.textContent.trim().replace(/^\(|\)$/g, '') || '';
    const week = {
      index,
      card,
      date,
      label: heading.replace(/^\s*Week:\s*/i, '').trim(),
      tag: U.titleCase(tagText),
      author: card.querySelector('.text-muted.small')?.textContent.replace(/^\s*By\s*/i, '').trim() || '',
      topic: labelled(card, 'Description'),
      announcement: labelled(card, 'Announcement'),
      items: [],
    };
    for (const label of card.querySelectorAll('[id^="content"]')) {
      const strong = label.querySelector('strong');
      if (!strong) continue;
      const box = label.closest('.card-body') || label.parentElement;
      const anchor = box.querySelector('a.contentbtn, a[href*="/Uploads/"]');
      const vod = box.querySelector('input.vodbutton');
      const type = (/\(([^()]*)\)\s*$/.exec(label.textContent.replace(strong.textContent, '')) || [])[1];
      const url = anchor?.href || vod?.dataset.url || '';
      const ext = (/\.([a-z0-9]{1,5})(?:$|\?)/i.exec(url) || [])[1]?.toLowerCase() || '';
      week.items.push({
        week,
        title: strong.textContent.replace(/^\s*\d+\s*-\s*/, '').trim(),
        type: U.titleCase(type || 'Other') || 'Other',
        anchor,
        vod,
        url,
        ext,
        id: anchor?.dataset.contentid || vod?.dataset.contentid || '',
        canDownload: Boolean(anchor && anchor.style.display !== 'none'),
        canWatch: Boolean(vod && vod.style.display !== 'none'),
        seen: (anchor?.dataset.seen || vod?.dataset.seen) !== 'no',
      });
    }
    return week;
  });
  const items = weeks.flatMap((w) => w.items);

  // Week numbers follow the calendar: the earliest date is week 1. Folders sharing a date share a number.
  const dates = [...new Set(weeks.filter((w) => w.date).map((w) => +w.date))].sort((a, b) => a - b);
  for (const w of weeks) w.number = w.date ? dates.indexOf(+w.date) + 1 : null;
  const today = new Date();
  // The latest week that has started counts as current only if it started within the last 7 days.
  const latestDate = dates.filter((d) => d <= +today).pop();
  const currentDate = latestDate && +today - latestDate < 7 * 86400000 ? latestDate : null;
  for (const w of weeks) {
    w.current = Boolean(w.date && +w.date === currentDate);
    w.latest = Boolean(w.date && +w.date === latestDate);
  }

  // ---------- Small helpers ----------

  const TYPE_COLORS = [
    [/solution/i, 'green'],
    [/lecture|slide/i, 'blue'],
    [/assignment|sheet|project/i, 'amber'],
    [/exam|midterm|final/i, 'red'],
    [/quiz/i, 'orange'],
    [/vod|video|record/i, 'purple'],
    [/lab|tutorial/i, 'teal'],
  ];
  const typeColor = (t) => (TYPE_COLORS.find(([re]) => re.test(t)) || [, 'gray'])[1];
  const EXT_COLORS = { pdf: 'red', mp4: 'purple', mkv: 'purple', mov: 'purple', ppt: 'orange', pptx: 'orange', doc: 'blue', docx: 'blue', xls: 'green', xlsx: 'green', zip: 'gray', rar: 'gray', png: 'teal', jpg: 'teal', jpeg: 'teal' };
  const fileIcon = (it) => (it.canWatch && !it.canDownload ? 'VID' : (it.ext || 'file').toUpperCase().slice(0, 4));
  const fileColor = (it) => (it.canWatch && !it.canDownload ? 'purple' : EXT_COLORS[it.ext] || 'gray');
  const weekName = (w) => (w.number ? `Week ${w.number}` : w.label || 'Week');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const ICONS = {
    download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',
  };

  // Tell the CMS a file was opened, like its own buttons do, so it stops showing as new.
  function markSeen(it) {
    if (it.seen) return;
    it.seen = true;
    if (it.anchor) it.anchor.dataset.seen = 'yes';
    if (it.vod) it.vod.dataset.seen = 'yes';
    it.row?.classList.remove('is-new');
    updateCounts();
    if (!it.id || !studentId) return;
    fetch('CourseViewStn.aspx/Goajax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: it.id, studentid: studentId }),
    }).catch(() => {});
  }

  // Click the CMS's own button so its download tracking and the file renaming both apply.
  function download(it) {
    if (!it.canDownload) return;
    it.anchor.click();
    it.seen = true;
    it.row?.classList.remove('is-new');
    updateCounts();
  }

  let busy = false;
  async function downloadMany(list, label) {
    list = list.filter((it) => it.canDownload);
    if (!list.length || busy) return;
    if (list.length > 1 && !confirm(`Download ${plural(list.length, 'file')} from ${label}?`)) return;
    busy = true;
    for (let i = 0; i < list.length; i++) {
      U.toast(`Downloading ${i + 1} of ${list.length}…`, 0);
      download(list[i]);
      await new Promise((r) => setTimeout(r, 700));
    }
    U.toast(`Started ${plural(list.length, 'download')}`);
    busy = false;
  }

  // ---------- Build the view ----------

  const types = [...items.reduce((m, it) => m.set(it.type, (m.get(it.type) || 0) + 1), new Map())].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const root = document.createElement('div');
  root.className = 'cmsv cmsv-course';
  root.innerHTML = `
    <header class="cmsv-hero">
      <div class="cmsv-hero-main">
        <div class="cmsv-eyebrow">${U.esc([course.code, season].filter(Boolean).join(' · '))}</div>
        <h1>${U.esc(course.name)}</h1>
        <div class="cmsv-stats">
          <span><b>${dates.length || weeks.length}</b> weeks</span>
          <span><b>${items.length}</b> files</span>
          <span class="cmsv-stat-new"><b data-new-count>0</b> new</span>
        </div>
      </div>
      <div class="cmsv-hero-actions">
        <button type="button" class="cmsv-btn" data-act="current">Go to ${currentDate ? 'current' : 'latest'} week</button>
        <button type="button" class="cmsv-btn cmsv-btn-ghost" data-act="classic" title="Show the original CMS layout">Classic view</button>
      </div>
    </header>

    <section class="cmsv-announce" hidden>
      <div class="cmsv-announce-head">
        <span>${ICONS.flag} Course announcements</span>
        <button type="button" class="cmsv-link" data-act="announce">Show more</button>
      </div>
      <div class="cmsv-announce-body"></div>
    </section>

    <div class="cmsv-layout">
      <nav class="cmsv-side" aria-label="Weeks">
        <div class="cmsv-side-title">Weeks</div>
        <ol class="cmsv-weeklist"></ol>
      </nav>

      <main class="cmsv-main">
        <div class="cmsv-toolbar">
          <label class="cmsv-search">${ICONS.search}<input type="search" placeholder="Search files…   ( / )" aria-label="Search files"></label>
          <button type="button" class="cmsv-toggle" data-act="new" aria-pressed="false">New only</button>
          <select class="cmsv-select" data-act="sort" aria-label="Sort weeks">
            <option value="desc">Newest week first</option>
            <option value="asc">Oldest week first</option>
          </select>
          <button type="button" class="cmsv-btn" data-act="download-shown"></button>
          <div class="cmsv-chips">
            <button type="button" class="cmsv-chip" data-type="" aria-pressed="true">All <span>${items.length}</span></button>
            ${types
              .map(
                ([t, n]) =>
                  `<button type="button" class="cmsv-chip" data-type="${U.esc(t)}" data-color="${typeColor(t)}" aria-pressed="false">${U.esc(t)} <span>${n}</span></button>`
              )
              .join('')}
          </div>
          <div class="cmsv-result"></div>
        </div>
        <div class="cmsv-weeks"></div>
        <div class="cmsv-empty" hidden>No files match. <button type="button" class="cmsv-link" data-act="reset">Clear filters</button></div>
      </main>
    </div>`;

  const weekList = root.querySelector('.cmsv-weeklist');
  const weeksBox = root.querySelector('.cmsv-weeks');

  for (const w of weeks) {
    const newCount = w.items.filter((it) => !it.seen).length;
    w.navItem = document.createElement('li');
    w.navItem.innerHTML = `
      <a href="#cmsv-week-${w.index}" class="${w.current ? 'is-current' : ''}">
        <span class="cmsv-num">${w.number ?? '•'}</span>
        <span class="cmsv-nav-text">
          <span class="cmsv-nav-date">${U.esc(U.fmtDate(w.date) || w.label)}${w.current ? ' <em>Now</em>' : ''}</span>
          <span class="cmsv-nav-topic">${U.esc(w.topic || w.tag || plural(w.items.length, 'file'))}</span>
        </span>
        <span class="cmsv-nav-count">${w.items.length}${newCount ? '<i></i>' : ''}</span>
      </a>`;
    w.navLink = w.navItem.firstElementChild;
    weekList.appendChild(w.navItem);

    w.section = document.createElement('section');
    w.section.className = 'cmsv-week' + (w.current ? ' is-current' : '');
    w.section.id = `cmsv-week-${w.index}`;
    w.section.innerHTML = `
      <header class="cmsv-week-head">
        <button type="button" class="cmsv-collapse" aria-expanded="true" title="Collapse">${ICONS.chevron}</button>
        <div class="cmsv-week-title">
          <h2>${U.esc(weekName(w))}${w.current ? '<span class="cmsv-badge cmsv-badge-now">Current week</span>' : ''}${w.tag ? `<span class="cmsv-badge">${U.esc(w.tag)}</span>` : ''}</h2>
          <div class="cmsv-week-meta">${U.esc(
            [U.fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), w.topic, w.author && `by ${w.author}`]
              .filter(Boolean)
              .join('  ·  ')
          )}</div>
        </div>
        <button type="button" class="cmsv-btn cmsv-btn-sm" data-act="download-week" title="Download the files shown in this week">${ICONS.download}<span></span></button>
      </header>
      ${w.announcement ? `<div class="cmsv-week-note">${ICONS.flag}<span>${U.esc(w.announcement)}</span></div>` : ''}
      <ul class="cmsv-files"></ul>
      ${w.items.length ? '' : '<div class="cmsv-week-empty">No files in this week yet.</div>'}`;

    const list = w.section.querySelector('.cmsv-files');
    for (const it of w.items) {
      it.row = document.createElement('li');
      it.row.className = 'cmsv-file' + (it.seen ? '' : ' is-new');
      const openable = it.url && /^(pdf|png|jpe?g|gif|mp4|txt)$/.test(it.ext) && it.canDownload;
      it.row.innerHTML = `
        <span class="cmsv-ext" data-color="${fileColor(it)}">${U.esc(fileIcon(it))}</span>
        <span class="cmsv-file-main">
          <span class="cmsv-file-title">${U.esc(it.title)}</span>
          <span class="cmsv-file-sub"><span class="cmsv-type" data-color="${typeColor(it.type)}">${U.esc(it.type)}</span><span class="cmsv-new">New</span></span>
        </span>
        <span class="cmsv-file-actions">
          ${it.canWatch ? `<button type="button" class="cmsv-icon-btn" data-act="watch" title="Watch">${ICONS.play}</button>` : ''}
          ${openable ? `<a class="cmsv-icon-btn" data-act="open" href="${U.esc(it.url)}" target="_blank" rel="noopener" title="Open in a new tab">${ICONS.open}</a>` : ''}
          ${it.canDownload ? `<button type="button" class="cmsv-icon-btn cmsv-icon-primary" data-act="download" title="Download">${ICONS.download}</button>` : ''}
        </span>`;
      it.row.cmsvItem = it;
      list.appendChild(it.row);
    }
    weeksBox.appendChild(w.section);
  }

  // Course announcement: a cleaned copy of the CMS text, without its light-theme inline colors.
  if (courseDesc && courseDesc.textContent.trim()) {
    const box = root.querySelector('.cmsv-announce');
    const body = box.querySelector('.cmsv-announce-body');
    const copy = courseDesc.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('hr, br:last-child').forEach((el) => el.remove());
    for (const el of [copy, ...copy.querySelectorAll('*')]) {
      el.style?.removeProperty('color');
      el.style?.removeProperty('background-color');
      el.style?.removeProperty('background');
      el.style?.removeProperty('font-family');
      el.style?.removeProperty('font-size');
      el.removeAttribute('class');
    }
    copy.querySelectorAll('a').forEach((a) => (a.target = '_blank'));
    body.appendChild(copy);
    box.hidden = false;
    requestAnimationFrame(() => {
      if (body.scrollHeight <= body.clientHeight + 4) box.querySelector('[data-act="announce"]').hidden = true;
    });
  }

  // ---------- Filtering ----------

  const search = root.querySelector('.cmsv-search input');
  const newToggle = root.querySelector('[data-act="new"]');
  const sortSelect = root.querySelector('[data-act="sort"]');
  const chips = [...root.querySelectorAll('.cmsv-chip')];
  const selectedTypes = new Set();
  let newOnly = false;

  const matches = (it, q) =>
    (!selectedTypes.size || selectedTypes.has(it.type)) &&
    (!newOnly || !it.seen) &&
    (!q || it.title.toLowerCase().includes(q) || it.type.toLowerCase().includes(q));

  function visibleItems(week) {
    return (week ? week.items : items).filter((it) => !it.row.classList.contains('cmsv-hide'));
  }

  function updateCounts() {
    root.querySelector('[data-new-count]').textContent = items.filter((it) => !it.seen).length;
    for (const w of weeks) {
      const dot = w.navLink.querySelector('.cmsv-nav-count i');
      if (dot && !w.items.some((it) => !it.seen)) dot.remove();
    }
  }

  function apply() {
    const q = search.value.trim().toLowerCase();
    const filtering = Boolean(q || newOnly || selectedTypes.size);
    let shown = 0;
    for (const w of weeks) {
      let inWeek = 0;
      for (const it of w.items) {
        const ok = matches(it, q);
        it.row.classList.toggle('cmsv-hide', !ok);
        if (ok) inWeek++;
      }
      shown += inWeek;
      const hideWeek = filtering && !inWeek;
      w.section.classList.toggle('cmsv-hide', hideWeek);
      w.navItem.classList.toggle('is-dim', hideWeek);
      const dl = visibleItems(w).filter((it) => it.canDownload).length;
      const btn = w.section.querySelector('[data-act="download-week"]');
      btn.hidden = !dl;
      btn.querySelector('span').textContent = dl > 1 ? `All ${dl}` : '';
    }
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.type ? selectedTypes.has(c.dataset.type) : !selectedTypes.size));
    newToggle.setAttribute('aria-pressed', String(newOnly));
    const downloadable = visibleItems().filter((it) => it.canDownload).length;
    const dlBtn = root.querySelector('[data-act="download-shown"]');
    dlBtn.innerHTML = `${ICONS.download} Download ${filtering ? 'shown' : 'all'} (${downloadable})`;
    dlBtn.disabled = !downloadable;
    root.querySelector('.cmsv-result').innerHTML = filtering
      ? `Showing <b>${shown}</b> of ${items.length} files · <button type="button" class="cmsv-link" data-act="reset">Clear</button>`
      : '';
    root.querySelector('.cmsv-empty').hidden = shown > 0;
  }

  function resetFilters() {
    search.value = '';
    newOnly = false;
    selectedTypes.clear();
    apply();
  }

  function sortWeeks(order) {
    const sorted = [...weeks].sort((a, b) => {
      const d = (+a.date || 0) - (+b.date || 0) || a.index - b.index;
      return order === 'asc' ? d : -d;
    });
    for (const w of sorted) {
      weeksBox.appendChild(w.section);
      weekList.appendChild(w.navItem);
    }
    try {
      localStorage.setItem('cmsv:sort', order);
    } catch {}
  }

  function scrollToWeek(w) {
    if (!w) return;
    w.section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    w.section.classList.remove('flash');
    void w.section.offsetWidth;
    w.section.classList.add('flash');
  }

  // ---------- Events ----------

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('.cmsv-chip');
    if (chip) {
      const t = chip.dataset.type;
      if (!t) selectedTypes.clear();
      else if (selectedTypes.has(t)) selectedTypes.delete(t);
      else selectedTypes.add(t);
      return apply();
    }

    const navLink = e.target.closest('.cmsv-weeklist a');
    if (navLink) {
      e.preventDefault();
      return scrollToWeek(weeks.find((w) => w.navLink === navLink));
    }

    const el = e.target.closest('[data-act]');
    if (!el) return;
    const it = el.closest('.cmsv-file')?.cmsvItem;
    const week = weeks.find((w) => w.section.contains(el));
    switch (el.dataset.act) {
      case 'download':
        return download(it);
      case 'open':
        return markSeen(it);
      case 'watch':
        markSeen(it);
        return it.vod.click();
      case 'download-week':
        return downloadMany(visibleItems(week), weekName(week));
      case 'download-shown':
        return downloadMany(visibleItems(), 'this course');
      case 'new':
        newOnly = !newOnly;
        return apply();
      case 'reset':
        return resetFilters();
      case 'current':
        return scrollToWeek(weeks.find((w) => w.current) || weeks.find((w) => w.latest) || weeks[0]);
      case 'classic':
        return U.setMode('classic');
      case 'announce': {
        const box = root.querySelector('.cmsv-announce');
        box.classList.toggle('is-open');
        el.textContent = box.classList.contains('is-open') ? 'Show less' : 'Show more';
        return;
      }
    }
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.cmsv-collapse');
    if (!btn) return;
    const section = btn.closest('.cmsv-week');
    const collapsed = section.classList.toggle('is-collapsed');
    btn.setAttribute('aria-expanded', String(!collapsed));
  });

  search.addEventListener('input', apply);
  sortSelect.addEventListener('change', () => sortWeeks(sortSelect.value));

  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      search.focus();
    } else if (e.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      apply();
      search.blur();
    }
  });

  // Highlight the week being read in the navigator.
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const w = weeks.find((x) => x.section === entry.target);
        weeks.forEach((x) => x.navLink.classList.toggle('is-active', x === w));
      }
    },
    { rootMargin: '-90px 0px -70% 0px' }
  );
  weeks.forEach((w) => spy.observe(w.section));

  // ---------- Mount ----------

  document.body.classList.add('cmsv-on');
  pageRoot.prepend(root);
  let order = 'desc';
  try {
    order = localStorage.getItem('cmsv:sort') || 'desc';
  } catch {}
  sortSelect.value = order;
  sortWeeks(order);
  updateCounts();
  apply();
})();
