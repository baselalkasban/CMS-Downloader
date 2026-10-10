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
