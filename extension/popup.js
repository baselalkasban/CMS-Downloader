const N = CMSNaming;
const fields = ['baseFolder', 'keepCourseCode', 'keepItemNumber'];

function read() {
  return {
    baseFolder: document.getElementById('baseFolder').value,
    keepCourseCode: document.getElementById('keepCourseCode').checked,
    keepItemNumber: document.getElementById('keepItemNumber').checked,
  };
}

function preview(settings) {
  document.getElementById('preview').textContent =
    'Downloads/' +
    N.buildPath(
      {
        url: 'https://cms.guc.edu.eg/Uploads/70/124/70318/GUC_124_70_70318.pdf',
        title: '1 - PA01 Propositional Logic (solution)',
        course: N.parseCourse('(|MATH501|) Mathematics V (Discrete Math) (124)'),
      },
      settings
    );
}

let timer;
async function save() {
  const settings = read();
  preview(settings);
  await chrome.storage.sync.set(settings);
  const saved = document.getElementById('saved');
  saved.textContent = 'Saved';
  clearTimeout(timer);
  timer = setTimeout(() => (saved.textContent = ''), 1200);
}

chrome.storage.sync.get(N.DEFAULTS).then((s) => {
  document.getElementById('baseFolder').value = s.baseFolder;
  document.getElementById('keepCourseCode').checked = s.keepCourseCode;
  document.getElementById('keepItemNumber').checked = s.keepItemNumber;
  preview(s);
  for (const id of fields) document.getElementById(id).addEventListener('input', save);
});

// Update check: compare with the manifest on GitHub.
const MANIFEST_URL =
  'https://raw.githubusercontent.com/baselalkasban/CMS-Downloader/claude/awesome-faraday-gfnufa/extension/manifest.json';
const current = chrome.runtime.getManifest().version;
document.getElementById('version').textContent = `Version ${current}`;
document.getElementById('reload').addEventListener('click', () => chrome.runtime.reload());

const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

fetch(MANIFEST_URL, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((latest) => {
    if (!latest || !newer(latest.version, current)) return;
    const box = document.getElementById('update');
    box.textContent = `Version ${latest.version} is available. Run update.bat in the CMS-Downloader folder, then press "Reload extension".`;
    box.hidden = false;
  })
  .catch(() => {});
