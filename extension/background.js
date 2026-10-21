importScripts('lib/naming.js');

const N = CMSNaming;
const PENDING_TTL_MS = 60_000;

// url key -> { filename, ts }. The worker stays alive while a click is being handled,
// so an in-memory map is enough and avoids storage read/write races.
const pending = new Map();

function register(url, filename) {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.ts > PENDING_TTL_MS) pending.delete(k);
  pending.set(N.urlKey(url), { filename, ts: now });
}

function take(urls) {
  for (const url of urls) {
    const key = N.urlKey(url);
    const entry = pending.get(key);
    if (entry) {
      pending.delete(key);
      return entry.filename;
    }
  }
  return null;
}

// No click was recorded (e.g. the file was saved from a preview or the PDF viewer):
// use the title remembered from the course page, or else keep the original file name.
async function fallbackPath(url) {
  const id = N.courseIdFromUrl(url);
  if (!id) return null;
  const [settings, { courses = {}, titles = {} }] = await Promise.all([
    chrome.storage.sync.get(N.DEFAULTS),
    chrome.storage.local.get(['courses', 'titles']),
  ]);
  const course = courses[id] || { id, code: '', name: `Course ${id}` };
  const title = titles[N.urlKey(url)];
  if (title) return N.buildPath({ url, title, course }, settings);
  return N.buildPath({ url, title: N.originalName(url), course }, { ...settings, keepItemNumber: true });
}

async function resolveFilename(item) {
  const urls = [item.url, item.finalUrl].filter(Boolean);
  // The click message can arrive a moment after the download starts.
  for (let i = 0; i < 15; i++) {
    const name = take(urls);
    if (name) return name;
    await new Promise((r) => setTimeout(r, 100));
  }
  return fallbackPath(item.finalUrl || item.url);
}

function isCms(url) {
  try {
    return new URL(url).hostname === 'cms.guc.edu.eg';
  } catch {
    return false;
  }
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (!isCms(item.finalUrl || item.url)) return; // leave other downloads alone
  resolveFilename(item)
    .then((filename) => (filename ? suggest({ filename, conflictAction: 'uniquify' }) : suggest()))
    .catch(() => suggest());
  return true; // suggest is called asynchronously
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'register') register(msg.url, msg.filename);
});
