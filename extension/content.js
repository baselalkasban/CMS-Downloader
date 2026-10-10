(() => {
  const N = CMSNaming;
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
    const onPage = coursesOnPage();
    return onPage[id] || courseMap[id] || null;
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
      if (!isDownloadLink(a)) return;
      chrome.runtime.sendMessage({ type: 'register', url: a.href, filename: pathFor(a) });
    },
    true
  );

  function addDownloadAllButton() {
    const links = [...document.querySelectorAll('a')].filter(isDownloadLink);
    const unique = [...new Map(links.map((a) => [N.urlKey(a.href), a])).values()];
    if (!unique.length) return;

    const btn = document.createElement('button');
    btn.textContent = `Download all (${unique.length})`;
    btn.title = 'Download every file on this course page into its course folder';
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
    btn.addEventListener('click', () => {
      if (!confirm(`Download ${unique.length} files from this course?`)) return;
      const items = unique.map((a) => ({ url: a.href, filename: pathFor(a) }));
      chrome.runtime.sendMessage({ type: 'downloadAll', items });
    });
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
