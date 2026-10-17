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

// No click was recorded (e.g. the file was opened from "View Content"):
// still drop it into its course folder, keeping the original file name.
async function fallbackPath(url) {
  const id = N.courseIdFromUrl(url);
  if (!id) return null;
  const [settings, { courses = {} }] = await Promise.all([
    chrome.storage.sync.get(N.DEFAULTS),
    chrome.storage.local.get('courses'),
  ]);
  const course = courses[id] || { id, code: '', name: `Course ${id}` };
  return N.buildPath({ url, title: N.originalName(url), course }, { ...settings, keepItemNumber: true });
}

const CMS_TABS = 'https://cms.guc.edu.eg/*';
const CONTENT_FILES = ['lib/naming.js', 'content.js'];

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
}

// Ask the open CMS tabs which title belongs to this file. Tabs whose content script
// is missing or disconnected (e.g. open since before an update) get a fresh copy first.
async function lookupInTabs(url) {
  const tabs = await chrome.tabs.query({ url: CMS_TABS });
  for (const tab of tabs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const name = await chrome.tabs.sendMessage(tab.id, { type: 'lookup', url });
        if (name) return name;
        break;
      } catch {
        if (attempt === 0) await inject(tab.id).catch(() => {});
      }
    }
  }
  return null;
}

async function resolveFilename(item) {
  const urls = [item.url, item.finalUrl].filter(Boolean);
  // The click message can arrive a moment after the download starts.
  for (let i = 0; i < 5; i++) {
    const name = take(urls);
    if (name) return name;
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const url of urls) {
    const name = await lookupInTabs(url).catch(() => null);
    if (name) return name;
  }
  return take(urls) || fallbackPath(item.finalUrl || item.url);
}

// Tabs opened before an install/update keep a disconnected script; give them a working one.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: CMS_TABS });
  for (const tab of tabs) inject(tab.id).catch(() => {});
});

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
