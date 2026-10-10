// Shared naming helpers, loaded by both the content script and the service worker.
var CMSNaming = (() => {
  const DEFAULTS = {
    baseFolder: 'CMS Pro',
    keepCourseCode: false,
    keepItemNumber: false,
  };

  // Matches "(|CSEN605|) Digital System Design (429)".
  const COURSE_RE = /\(\|\s*([^|()]+?)\s*\|\)\s*([^\n]+?)\s*\((\d+)\)/;

  function parseCourse(text) {
    const m = COURSE_RE.exec(text || '');
    if (!m) return null;
    return { code: m[1].trim(), name: m[2].trim(), id: m[3] };
  }

  // Makes a single path segment safe for Windows/macOS/Linux file systems.
  function sanitize(segment) {
    let s = String(segment || '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .replace(/[. ]+$/, '');
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = '_' + s;
    return s.slice(0, 150);
  }

  function courseFolder(course, settings) {
    const name = settings.keepCourseCode ? `${course.code} ${course.name}` : course.name;
    return sanitize(name) || sanitize(`Course ${course.id}`);
  }

  function baseSegments(settings) {
    return String(settings.baseFolder || '')
      .split(/[/\\]+/)
      .map(sanitize)
      .filter(Boolean);
  }

  function extensionOf(url) {
    try {
      const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      const m = /\.[A-Za-z0-9]{1,8}$/.exec(last);
      return m ? m[0] : '';
    } catch {
      return '';
    }
  }

  function originalName(url) {
    try {
      return sanitize(decodeURIComponent(new URL(url).pathname.split('/').pop() || ''));
    } catch {
      return '';
    }
  }

  // Builds "CMS Pro/Digital System Design/PA01 Propositional Logic (solution).pdf".
  function buildPath({ url, title, course }, settings) {
    const ext = extensionOf(url);
    let file = String(title || '').trim();
    if (!settings.keepItemNumber) file = file.replace(/^\d+\s*-\s*/, '');
    file = sanitize(file);
    if (file && ext && !file.toLowerCase().endsWith(ext.toLowerCase())) file += ext;
    if (!file) file = originalName(url) || 'download';

    const parts = baseSegments(settings);
    if (course) parts.push(courseFolder(course, settings));
    parts.push(file);
    return parts.join('/');
  }

  // "/Uploads/<season>/<courseId>/<contentId>/<file>" -> courseId
  function courseIdFromUrl(url) {
    try {
      const m = /\/uploads\/\d+\/(\d+)\//i.exec(new URL(url).pathname);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  function urlKey(url) {
    try {
      const u = new URL(url);
      return (u.host + decodeURIComponent(u.pathname)).toLowerCase();
    } catch {
      return String(url).toLowerCase();
    }
  }

  return {
    DEFAULTS,
    parseCourse,
    sanitize,
    buildPath,
    originalName,
    courseIdFromUrl,
    urlKey,
  };
})();
