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

// Theme picker: the CMS tabs follow the stored theme live.
const themesBox = document.getElementById('themes');
chrome.storage.sync.get({ theme: CMSThemes[0].id }).then(({ theme }) => {
  for (const t of CMSThemes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme';
    b.title = `${t.name}: ${t.description}`;
    b.setAttribute('aria-pressed', String(t.id === theme));
    b.innerHTML = `<span class="sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>${t.name.split(' ')[0]}`;
    b.addEventListener('click', () => {
      chrome.storage.sync.set({ theme: t.id });
      themesBox.querySelectorAll('.theme').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    themesBox.appendChild(b);
  }
});

// Outlook and local AI settings.
const MAIL_AI_DEFAULTS = { mailShowGroup: true, mailSkin: true, aiUrl: 'http://localhost:11434', aiModel: '', aiAuto: true };
const aiStatus = document.getElementById('aiStatus');
const aiModel = document.getElementById('aiModel');

function setStatus(text, kind = '') {
  aiStatus.textContent = text;
  aiStatus.className = `hint ${kind}`;
}

async function testAi() {
  setStatus('Connecting…');
  await chrome.storage.sync.set({ aiUrl: document.getElementById('aiUrl').value.trim() || MAIL_AI_DEFAULTS.aiUrl });
  const res = await chrome.runtime.sendMessage({ type: 'ai-models' }).catch((e) => ({ ok: false, error: e.message }));
  if (!res?.ok) return setStatus(res?.error || 'Could not connect.', 'err');
  const chosen = aiModel.value;
  aiModel.innerHTML = '<option value="">Automatic (first installed model)</option>' + res.result.map((m) => `<option>${m.replace(/[<&]/g, '')}</option>`).join('');
  aiModel.value = res.result.includes(chosen) ? chosen : '';
  setStatus(res.result.length ? `Connected. ${res.result.length} model${res.result.length === 1 ? '' : 's'} found.` : 'Connected, but no models are installed. In Ollama run: ollama pull llama3.2', res.result.length ? 'ok' : 'err');
}

chrome.storage.sync.get(MAIL_AI_DEFAULTS).then((s) => {
  document.getElementById('mailShowGroup').checked = s.mailShowGroup;
  document.getElementById('mailSkin').checked = s.mailSkin;
  document.getElementById('aiUrl').value = s.aiUrl;
  document.getElementById('aiAuto').checked = s.aiAuto;
  if (s.aiModel) aiModel.innerHTML += `<option selected>${s.aiModel.replace(/[<&]/g, '')}</option>`;
  for (const id of ['mailShowGroup', 'mailSkin', 'aiAuto']) {
    document.getElementById(id).addEventListener('change', (e) => chrome.storage.sync.set({ [id]: e.target.checked }));
  }
  document.getElementById('aiUrl').addEventListener('change', (e) => chrome.storage.sync.set({ aiUrl: e.target.value.trim() || MAIL_AI_DEFAULTS.aiUrl }));
  aiModel.addEventListener('change', () => chrome.storage.sync.set({ aiModel: aiModel.value }));
  document.getElementById('aiTest').addEventListener('click', testAi);
});
