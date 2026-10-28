// Redesigned home page: course cards with progress, unviewed files and an activity feed.
(() => {
  const U = CMSUI;
  const pageRoot = document.querySelector('.app-main__inner');
  const courseTable = document.querySelector('[id$="GridViewcourses"]');
  if (!pageRoot || !courseTable) return;

  if (U.getMode() !== 'pro') {
    U.addProSwitch();
    return;
  }

  const COURSE_RE = /\(\|\s*([^|()]+?)\s*\|\)\s*([^\n]+?)\s*\((\d+)\)/;
  const parseCourse = (text) => {
    const m = COURSE_RE.exec(text || '');
    return m ? { code: m[1].trim(), name: m[2].trim(), id: m[3] } : null;
  };
  const rows = (table) => [...(table?.querySelectorAll('tr') || [])].filter((tr) => tr.querySelector('td'));
  const cellText = (tr, i) => tr.querySelectorAll('td')[i]?.textContent.trim() || '';
  const parseTime = (s) => {
    const t = new Date(s);
    return isNaN(t) ? null : t;
  };

  function ago(t) {
    if (!t) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return U.fmtDate(t);
  }

  function dayLabel(t) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // ---------- Read the original page ----------

  const PALETTE = ['blue', 'amber', 'green', 'purple', 'red', 'teal', 'orange'];
  const courses = rows(courseTable)
    .map((tr, i) => {
      const c = parseCourse(cellText(tr, 1));
      if (!c) return null;
      return { ...c, season: cellText(tr, 3), button: tr.querySelector('input[type="submit"], a'), color: PALETTE[i % PALETTE.length] };
    })
    .filter(Boolean);
  const byId = new Map(courses.map((c) => [c.id, c]));

  for (const tr of rows(document.querySelector('[id$="GridViewunseen"]'))) {
    const c = byId.get(parseCourse(cellText(tr, 0))?.id);
    const m = /(\d+)\s*\/\s*(\d+)/.exec(cellText(tr, 1));
    if (c && m) Object.assign(c, { unseen: +m[1], total: +m[2] });
  }

  const unseen = rows(document.querySelector('[id$="GridViewunseencontent"]'))
    .map((tr) => ({
      course: byId.get(parseCourse(cellText(tr, 0))?.id),
      title: cellText(tr, 1),
      type: U.titleCase(cellText(tr, 2)),
      time: parseTime(cellText(tr, 3)),
      teacher: cellText(tr, 4),
    }))
    .filter((x) => x.course);

  const activity = [...document.querySelectorAll('.vertical-timeline-item')]
    .map((el) => {
      const h = el.querySelector('.timeline-title');
      const course = byId.get(parseCourse(h?.querySelector('strong')?.textContent)?.id);
      const raw = (h?.textContent.split(',')[0] || '').trim();
      const kind = /announcement/i.test(raw) ? 'Announcement' : /new content/i.test(raw) ? 'New content' : /new week/i.test(raw) ? 'New week' : raw;
      // "A new content has been added to course: '…', week of: (10/5/2026), by x" -> "Week of 10/5/2026 · by x"
      const text = el.querySelector('p')?.textContent.replace(/\s+/g, ' ').trim() || '';
      const week = (/week(?: of)?:\s*\(?([\d/]+)\)?/i.exec(text) || [])[1];
      const by = (/\bby\s+(\S+)\s*$/i.exec(text) || [])[1];
      return {
        course,
        kind,
        text: [/announcement/i.test(raw) && 'Announcement updated', week && `Week of ${week}`, by && `by ${by}`].filter(Boolean).join(' · ') || text,
        time: parseTime(el.querySelector('.vertical-timeline-element-date')?.textContent.trim()),
      };
    })
    .filter((x) => x.course && x.time);

  for (const c of courses) {
    c.latest = activity.filter((a) => a.course === c).sort((a, b) => b.time - a.time)[0];
    c.weekUpdates = activity.filter((a) => a.course === c && Date.now() - a.time < 7 * 86400000).length;
  }

  const user = document.querySelector('[id$="Labelusername"]')?.textContent.trim() || '';
  const season = courses[0]?.season || '';
  const totalUnseen = courses.reduce((n, c) => n + (c.unseen || 0), 0);
  const weekUpdates = activity.filter((a) => Date.now() - a.time < 7 * 86400000).length;
  const kindColor = (k) => (/new content/i.test(k) ? 'green' : /new week/i.test(k) ? 'blue' : /announcement/i.test(k) ? 'amber' : 'gray');

  // ---------- Build the view ----------

  const root = document.createElement('div');
  root.className = 'cmsv cmsv-home';
  root.innerHTML = `
    <header class="cmsv-hero">
      <div class="cmsv-hero-main">
        <div class="cmsv-eyebrow">${U.esc(season)}</div>
        <h1>${user ? `Welcome back, ${U.esc(user)}` : 'Welcome back'}</h1>
        <div class="cmsv-stats">
          <span><b>${courses.length}</b> courses</span>
          <span class="cmsv-stat-new"><b>${totalUnseen}</b> files not opened yet</span>
          <span><b>${weekUpdates}</b> updates this week</span>
        </div>
      </div>
      <div class="cmsv-hero-actions">
        <button type="button" class="cmsv-btn cmsv-btn-ghost" data-act="classic" title="Show the original CMS layout">Classic view</button>
      </div>
    </header>

    <nav class="cmsv-quick" aria-label="CMS pages">
      <button type="button" class="cmsv-quick-search" data-act="palette">${'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}<span>Search courses, weeks and files…</span><kbd>Ctrl K</kbd></button>
      <a href="/apps/student/ViewAllCourseStn.aspx">All courses</a>
      <a href="/apps/student/AllNotification.aspx">Notifications</a>
      <a href="/apps/student/ViewComplaintStn.aspx">My issues</a>
      <a href="/apps/student/Chat/StnGroupChatlist.aspx">Group chats</a>
    </nav>

    <section class="cmsv-continue" hidden>
      <h2 class="cmsv-section-title">Continue where you left off</h2>
      <div class="cmsv-continue-list"></div>
    </section>

    <h2 class="cmsv-section-title">Your courses</h2>
    <div class="cmsv-courses">
      ${courses
        .map((c, i) => {
          const viewed = c.total ? Math.round(((c.total - c.unseen) / c.total) * 100) : null;
          return `
        <button type="button" class="cmsv-course-card" data-course="${i}" data-color="${c.color}">
          <span class="cmsv-course-top">
            <span class="cmsv-code">${U.esc(c.code)}</span>
            ${c.unseen ? `<span class="cmsv-pill-new">${c.unseen} new</span>` : '<span class="cmsv-pill-done">All caught up</span>'}
          </span>
          <span class="cmsv-course-name">${U.esc(c.name)}</span>
          ${
            viewed === null
              ? ''
              : `<span class="cmsv-progress" title="${c.total - c.unseen} of ${c.total} files opened"><i style="width:${viewed}%"></i></span>
                 <span class="cmsv-progress-label">${c.total - c.unseen} of ${c.total} files opened</span>`
          }
          <span class="cmsv-course-latest">${
            c.latest ? `${U.esc(c.latest.kind)} · ${U.esc(ago(c.latest.time))}` : 'No recent activity'
          }</span>
        </button>`;
        })
        .join('')}
    </div>

    <div class="cmsv-home-cols">
      <section class="cmsv-panel">
        <div class="cmsv-panel-head"><h2>New for you</h2><span>${unseen.length ? 'Latest files you haven’t opened' : ''}</span></div>
        ${
          unseen.length
            ? `<ul class="cmsv-feed">${unseen
                .map(
                  (x) => `
          <li><button type="button" class="cmsv-feed-item" data-course="${courses.indexOf(x.course)}" title="Open ${U.esc(x.course.name)}">
            <span class="cmsv-dot" data-color="${x.course.color}"></span>
            <span class="cmsv-feed-main">
              <span class="cmsv-feed-title">${U.esc(x.title)}</span>
              <span class="cmsv-feed-sub">${U.esc(x.course.code)} · ${U.esc(x.type)}${x.teacher ? ` · ${U.esc(x.teacher)}` : ''}</span>
            </span>
            <span class="cmsv-feed-time">${U.esc(ago(x.time))}</span>
          </button></li>`
                )
                .join('')}</ul>`
            : '<div class="cmsv-panel-empty">You’ve opened everything. Nice!</div>'
        }
      </section>

      <section class="cmsv-panel">
        <div class="cmsv-panel-head"><h2>Activity</h2><span>Course updates from the CMS</span></div>
        ${
          activity.length
            ? [...activity.reduce((m, a) => m.set(dayLabel(a.time), [...(m.get(dayLabel(a.time)) || []), a]), new Map())]
                .map(
                  ([day, list]) => `
          <div class="cmsv-day">${U.esc(day)}</div>
          <ul class="cmsv-feed">${list
            .map(
              (a) => `
            <li><button type="button" class="cmsv-feed-item" data-course="${courses.indexOf(a.course)}" title="Open ${U.esc(a.course.name)}">
              <span class="cmsv-kind" data-color="${kindColor(a.kind)}">${U.esc(a.kind)}</span>
              <span class="cmsv-feed-main">
                <span class="cmsv-feed-title">${U.esc(a.course.name)}</span>
                <span class="cmsv-feed-sub">${U.esc(a.text)}</span>
              </span>
              <span class="cmsv-feed-time">${U.esc(a.time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))}</span>
            </button></li>`
            )
            .join('')}</ul>`
                )
                .join('')
            : '<div class="cmsv-panel-empty">No recent activity.</div>'
        }
      </section>
    </div>`;

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="classic"]')) return U.setMode('classic');
    if (e.target.closest('[data-act="palette"]')) return window.CMSPalette?.open();
    const el = e.target.closest('[data-course]');
    const c = el && courses[+el.dataset.course];
    if (!c?.button) return;
    el.classList.add('is-loading');
    c.button.click(); // the CMS opens courses through its own form button
  });

  // Files opened recently in the Pro view (saved by the course page).
  chrome.storage.local.get({ recent: [] }).then(({ recent }) => {
    const list = recent.slice(0, 6);
    if (!list.length) return;
    const color = (code) => courses.find((c) => c.code === code)?.color || 'gray';
    root.querySelector('.cmsv-continue-list').innerHTML = list
      .map(
        (r) => `
        <a class="cmsv-continue-card" data-color="${color(r.code)}" href="/apps/student/CourseViewStn.aspx?id=${U.esc(r.courseId)}&sid=${U.esc(r.sid)}#cmsv-file=${U.esc(r.fileId)}">
          <span class="cmsv-code">${U.esc(r.code || '')}</span>
          <span class="cmsv-continue-title">${U.esc(r.title)}</span>
          <span class="cmsv-continue-sub">${U.esc([r.type, ago(new Date(r.at))].filter(Boolean).join(' · '))}</span>
        </a>`
      )
      .join('');
    root.querySelector('.cmsv-continue').hidden = false;
  });

  document.body.classList.add('cmsv-on');
  pageRoot.prepend(root);
})();
