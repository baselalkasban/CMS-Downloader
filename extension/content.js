(() => {
  // Injected twice into the same extension context (manifest + reinjection on update)? Run once.
  if (window.__cmsDownloader === chrome.runtime) return;
  window.__cmsDownloader = chrome.runtime;

  const N = CMSNaming;
  // After the extension is reloaded or updated, a copy left running in an open tab loses its connection.
  const alive = () => Boolean(chrome.runtime?.id);
  let settings = { ...N.DEFAULTS };
  let courseMap = {};

  chrome.storage.sync.get(N.DEFAULTS).then((s) => (settings = s));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue ?? N.DEFAULTS[k];
    }
  });

  // Every course name shown on the page, e.g. the home page's "Courses enrolled in" table.
  function coursesOnPage() {
    const found = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue;
      if (!text.includes('(|')) continue;
      const course = N.parseCourse(text) || N.parseCourse(walker.currentNode.parentElement?.textContent);
      if (course && !found[course.id]) found[course.id] = course;
    }
    return found;
  }

  function currentCourseId() {
    return new URLSearchParams(location.search).get('id');
  }

  function currentCourse() {
    const id = currentCourseId();
    if (!id) return null;
    const label = document.querySelector('[id$="LabelCourseName"]');
    const fromLabel = label && N.parseCourse(label.textContent);
    if (fromLabel) return fromLabel;
    return coursesOnPage()[id] || courseMap[id] || null;
  }

  function isDownloadLink(a) {
    if (!a || !a.href) return false;
    if (/\/uploads\//i.test(a.href)) return true;
    return /download content/i.test(a.textContent) && /^https?:/i.test(a.href);
  }

  // The bold title rendered above an item's buttons, e.g. "1 - PA01 Propositional Logic (solution)".
  function itemTitle(a) {
    let node = a;
    for (let i = 0; i < 6 && node.parentElement; i++) {
      node = node.parentElement;
      const candidates = [...node.querySelectorAll('strong, b')].filter(
        (el) =>
          !el.contains(a) &&
          !el.closest('a') &&
          el.textContent.trim() &&
          el.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (candidates.length) return candidates[candidates.length - 1].textContent.trim();
    }
    return a.getAttribute('download') || '';
  }

  function pathFor(a) {
    const courseId = N.courseIdFromUrl(a.href) || currentCourseId();
    const course = currentCourse() || (courseId && courseMap[courseId]) || null;
    return N.buildPath({ url: a.href, title: itemTitle(a), course }, settings);
  }

  // Let the site handle the click as usual; just tell the background which name to give the file.
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest?.('a');
      if (!isDownloadLink(a) || !alive()) return;
      chrome.runtime.sendMessage({ type: 'register', url: a.href, filename: pathFor(a) }).catch(() => {});
    },
    true
  );

  // The background asks for a file's name when no click message reached it.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'lookup') return;
    const key = N.urlKey(msg.url);
    const a = [...document.querySelectorAll('a')].find((el) => isDownloadLink(el) && N.urlKey(el.href) === key);
    sendResponse(a ? pathFor(a) : null);
  });

  // Download links in the weeks currently shown (respects the CMS week/tag filters).
  function visibleDownloadLinks() {
    const links = [...document.querySelectorAll('a')].filter((a) => isDownloadLink(a) && a.getClientRects().length);
    return [...new Map(links.map((a) => [N.urlKey(a.href), a])).values()];
  }

  function addDownloadAllButton() {
    document.querySelectorAll('[data-cms-downloader]').forEach((el) => el.remove());
    if (!visibleDownloadLinks().length) return;

    const btn = document.createElement('button');
    const label = () => `Download all (${visibleDownloadLinks().length})`;
    btn.textContent = label();
    btn.dataset.cmsDownloader = '1';
    btn.title = 'Download every file shown on this page into its course folder';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: 99999,
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      background: '#3b82f6',
      color: '#fff',
      font: '600 14px system-ui, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,.35)',
    });
    btn.addEventListener('click', async () => {
      const links = visibleDownloadLinks();
      if (!links.length || !confirm(`Download ${links.length} files from this course?`)) return;
      btn.disabled = true;
      // Click the real buttons so the CMS login is reused and items get marked as seen.
      for (let i = 0; i < links.length; i++) {
        btn.textContent = `Downloading ${i + 1}/${links.length}...`;
        links[i].click();
        await new Promise((r) => setTimeout(r, 700));
      }
      btn.disabled = false;
      btn.textContent = label();
    btn.dataset.cmsDownloader = '1';
    });
    // Keep the count in sync with the CMS filters.
    document.addEventListener('click', () => setTimeout(() => alive() && !btn.disabled && (btn.textContent = label()), 300));
    document.body.appendChild(btn);
  }

  chrome.storage.local.get({ courses: {} }).then(({ courses }) => {
    courseMap = courses;
    // Remember course names seen on any page so the course folder can always be resolved.
    const onPage = coursesOnPage();
    if (Object.keys(onPage).length) {
      chrome.storage.local.set({ courses: { ...courseMap, ...onPage } });
      courseMap = { ...courseMap, ...onPage };
    }
  });

  if (/CourseViewStn\.aspx/i.test(location.pathname)) addDownloadAllButton();
})();
