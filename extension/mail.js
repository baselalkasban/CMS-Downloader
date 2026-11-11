// GUC Outlook (mail.guc.edu.eg): short subjects, plus a Mail assistant panel with key details,
// a local-AI summary and favorites. Outlook's markup isn't relied on: subjects are found by their text
// and the open message through its "Message body" accessibility label (with fallbacks).
(() => {
  if (window.top !== window) return; // Outlook embeds frames; run once, in the main page
  const U = CMSUI;
  const M = CMSMail;
  const settings = { mailShowGroup: true, mailPanelOpen: true, aiAuto: true, aiModel: '' };

  // ---------- Short subjects everywhere ----------

  const SKIP = 'textarea, input, script, style, [contenteditable=""], [contenteditable="true"], .cmsv';

  function fixTextNode(node) {
    const parent = node.parentElement;
    if (!parent || !M.isNoisy(node.data) || parent.closest(SKIP)) return;
    const c = M.cleanSubject(node.data);
    if (!c.changed) return;
    parent.dataset.cmsmSubject = node.data.trim();
    parent.dataset.cmsmTitle = c.title;
    if (c.group) parent.dataset.cmsmGroup = c.group;
    else delete parent.dataset.cmsmGroup;
    node.data = c.title;
    if (settings.mailShowGroup && c.group) {
      const chip = document.createElement('span');
      chip.className = 'cmsm-chip';
      chip.textContent = c.group;
      chip.title = c.fullGroup;
      chip.dataset.for = c.title;
      node.after(chip);
    }
  }

  function fixSubtree(root) {
    if (root.nodeType === Node.TEXT_NODE) return fixTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (M.isNoisy(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const found = [];
    while (walker.nextNode()) found.push(walker.currentNode);
    found.forEach(fixTextNode);
  }

  // Outlook reuses list rows for other messages: drop tags that no longer sit next to their subject.
  function dropStaleChips() {
    for (const chip of document.querySelectorAll('.cmsm-chip')) {
      const prev = chip.previousSibling;
      if (!prev || prev.nodeType !== Node.TEXT_NODE || prev.data !== chip.dataset.for || !settings.mailShowGroup) chip.remove();
    }
  }

  // ---------- Reading the open message ----------

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 10 && r.bottom > 0 && r.top < innerHeight;
  };
  const BODY_SELECTORS = [
    '[aria-label="Message body" i]',
    '[aria-label="Message contents" i]',
    'div[role="document"]',
    '[id^="Item.MessageUniqueBody"]',
    '[id^="Item.MessagePartBody"]',
    '.ReadMsgBody',
  ];

  function findBody() {
    for (const sel of BODY_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!el.closest('.cmsv') && visible(el) && el.innerText.trim().length > 2) return el;
      }
    }
    return null;
  }

  // The header (subject, sender, date) sits just above the body: the subject is its largest text.
  function readHeader(body) {
    const b = body.getBoundingClientRect();
    let region = body;
    for (let i = 0; i < 8 && region.parentElement; i++) {
      region = region.parentElement;
      if (region.getBoundingClientRect().top < b.top - 40) break;
    }
    const lines = [];
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      const text = node.data.trim();
      if (!text || !el || body.contains(el) || el.closest('.cmsv, button, [role="button"], [role="menuitem"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > b.top + 4 || r.top < b.top - 420 || r.right < b.left || r.width < 1) continue;
      lines.push({ el, text, size: parseFloat(getComputedStyle(el).fontSize) || 0, top: r.top });
    }
    const subjectLine = [...lines].filter((l) => l.text.length > 2).sort((a, b2) => b2.size - a.size || a.top - b2.top)[0];
    const holder = subjectLine?.el.closest('[data-cmsm-subject]');
    const raw = holder && holder.textContent.includes(holder.dataset.cmsmTitle) ? holder.dataset.cmsmSubject : subjectLine?.text || '';
    const fromLine = lines.find((l) => /@[\w.-]+\.\w+/.test(l.text) && l !== subjectLine);
    const dateLine = lines.find((l) => /\b(?:today|yesterday|mon|tue|wed|thu|fri|sat|sun)\w*\b.*\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(l.text));
    // The sender is often split into pieces (name, "<", address, ">"): read the whole line around the address.
    const fromBlock = fromLine?.el.closest('div, p, li, td, span[title]') || fromLine?.el;
    const fromText = (fromBlock?.innerText || fromLine?.text || '').split('\n').find((l) => l.includes('@')) || fromLine?.text || '';
    // "GUC Notification System (DO NOT REPLY) <notify@guc.edu.eg>" -> name + address
    const email = (/[\w.+-]+@[\w.-]+\.\w+/.exec(fromText) || [''])[0];
    let name = fromText.replace(/<[^>]*>/, '').replace(email, '').trim();
    if (!name) {
      const near = lines.filter((l) => l !== subjectLine && l.top <= (fromLine?.top ?? 0) && !/@/.test(l.text)).pop();
      name = near?.text || '';
    }
    return { raw, from: name || email, email, date: dateLine?.text || '' };
  }

  function readOpenMessage() {
    const body = findBody();
    if (!body) return null;
    const head = readHeader(body);
    const text = body.innerText.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    const subject = M.cleanSubject(head.raw);
    return {
      key: M.messageKey(head.raw, head.email || head.from, text),
      raw: head.raw,
      title: subject.title || '(no subject)',
      group: subject.group,
      fullGroup: subject.fullGroup,
      from: head.from,
      email: head.email,
      date: head.date,
      text,
    };
  }

  // ---------- Storage: favorites and cached summaries ----------

  let favorites = {}; // key -> saved message
  let summaries = {}; // key -> AI summary

  async function loadStore() {
    ({ mailFavorites: favorites = {}, mailSummaries: summaries = {} } = await chrome.storage.local.get(['mailFavorites', 'mailSummaries']));
  }
  function saveSummaries() {
    const keys = Object.keys(summaries);
    if (keys.length > 300) keys.sort((a, b) => (summaries[a].at || 0) - (summaries[b].at || 0)).slice(0, keys.length - 300).forEach((k) => delete summaries[k]);
    chrome.storage.local.set({ mailSummaries: summaries });
  }

  function toggleFavorite(msg) {
    if (favorites[msg.key]) delete favorites[msg.key];
    else {
      favorites[msg.key] = {
        key: msg.key, title: msg.title, group: msg.group, fullGroup: msg.fullGroup, raw: msg.raw,
        from: msg.from, email: msg.email, date: msg.date, text: msg.text.slice(0, 8000), savedAt: Date.now(),
      };
    }
    chrome.storage.local.set({ mailFavorites: favorites });
    U.toast(favorites[msg.key] ? 'Added to favorites' : 'Removed from favorites');
    render();
  }

  // ---------- AI ----------

  const ai = { key: null, state: 'idle', error: '' }; // idle | loading | done | error

  async function summarize(msg, force = false) {
    if (!msg) return;
    if (!force && summaries[msg.key]) {
      Object.assign(ai, { key: msg.key, state: 'done', error: '' });
      return render();
    }
    Object.assign(ai, { key: msg.key, state: 'loading', error: '' });
    render();
    const res = await chrome.runtime.sendMessage({ type: 'ai-summarize', subject: msg.title, from: msg.from, date: msg.date, text: msg.text }).catch((e) => ({ ok: false, error: e.message }));
    if (ai.key !== msg.key) return; // the user moved to another message meanwhile
    if (res?.ok) {
      summaries[msg.key] = { ...res.result, at: Date.now() };
      saveSummaries();
      Object.assign(ai, { state: 'done' });
    } else {
      Object.assign(ai, { state: 'error', error: res?.error || 'Something went wrong.' });
    }
    render();
  }

  // ---------- Panel ----------

  const ICON = {
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>',
    todo: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/></svg>',
  };

  const panel = document.createElement('aside');
  panel.className = 'cmsv cmsm-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header class="cmsm-head">
      <div class="cmsm-tabs" role="tablist">
        <button type="button" role="tab" data-tab="email" aria-selected="true">This email</button>
        <button type="button" role="tab" data-tab="favs" aria-selected="false">Favorites <span class="cmsm-count"></span></button>
      </div>
      <button type="button" class="cmsv-icon-btn" data-act="close" title="Hide the assistant">${ICON.close}</button>
    </header>
    <div class="cmsm-pane" data-pane="email"></div>
    <div class="cmsm-pane" data-pane="favs" hidden>
      <label class="cmsv-search cmsm-favsearch">${ICON.search}<input type="search" placeholder="Search favorites…" aria-label="Search favorites"></label>
      <div class="cmsm-favlist"></div>
    </div>`;
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'cmsv cmsm-launcher';
  launcher.innerHTML = `${ICON.spark}<span>Mail assistant</span>`;

  let tab = 'email';
  let current = null;
  const expanded = new Set();

  function chips(list, icon) {
    return list.map((x) => `<span class="cmsm-fact">${icon}${U.esc(x)}</span>`).join('');
  }

  function renderEmail() {
    const pane = panel.querySelector('[data-pane="email"]');
    if (!current) {
      pane.innerHTML = `<div class="cmsm-empty">${ICON.spark}<p>Open an email to see its key details and an AI summary here.</p></div>`;
      return;
    }
    const m = current;
    const f = M.extractFacts(m.text);
    const fav = Boolean(favorites[m.key]);
    const factChips = [
      ...f.slots.map((x) => ['pin', x]),
      ...f.rooms.filter((r) => !f.slots.some((s) => s.endsWith(r))).map((x) => ['pin', x]),
      ...f.dates.map((x) => ['clock', x]),
      ...f.times.map((x) => ['clock', x]),
    ];
    const s = summaries[m.key];
    let aiHtml;
    if (ai.key === m.key && ai.state === 'loading') {
      aiHtml = `<div class="cmsm-loading"><i></i><i></i><i></i><span>Summarizing with your local AI…</span></div>`;
    } else if (ai.key === m.key && ai.state === 'error') {
      aiHtml = `<div class="cmsm-error">${U.esc(ai.error)}</div><button type="button" class="cmsv-btn cmsv-btn-sm" data-act="summarize">${ICON.refresh}<span>Try again</span></button>`;
    } else if (s) {
      aiHtml = `
        ${s.tldr ? `<p class="cmsm-tldr">${U.esc(s.tldr)}</p>` : ''}
        <dl class="cmsm-rows">
          ${s.when ? `<dt>${ICON.clock}When</dt><dd>${U.esc(s.when)}</dd>` : ''}
          ${s.where ? `<dt>${ICON.pin}Where</dt><dd>${U.esc(s.where)}</dd>` : ''}
          ${s.action ? `<dt>${ICON.todo}To do</dt><dd>${U.esc(s.action)}</dd>` : ''}
        </dl>
        ${s.key_points?.length ? `<ul class="cmsm-points">${s.key_points.map((p) => `<li>${U.esc(p)}</li>`).join('')}</ul>` : ''}
        <div class="cmsm-ai-foot"><span>${U.esc(s.model || 'Local AI')}</span>
          <button type="button" class="cmsv-icon-btn" data-act="copy" title="Copy summary">${ICON.copy}</button>
          <button type="button" class="cmsv-icon-btn" data-act="resummarize" title="Summarize again">${ICON.refresh}</button></div>`;
    } else {
      aiHtml = `<p class="cmsm-muted">Get a short summary from the AI running on your computer. The email never leaves your device.</p>
        <button type="button" class="cmsv-btn" data-act="summarize">${ICON.spark}<span>Summarize</span></button>`;
    }
    pane.innerHTML = `
      <div class="cmsm-msg">
        <div class="cmsm-msg-top">
          <h3 class="cmsm-title">${U.esc(m.title)}</h3>
          <button type="button" class="cmsm-star" data-act="fav" aria-pressed="${fav}" title="${fav ? 'Remove from favorites' : 'Add to favorites'}">${ICON.star}</button>
        </div>
        <div class="cmsm-meta">
          ${m.group ? `<span class="cmsm-chip" title="${U.esc(m.fullGroup)}">${U.esc(m.group)}</span>` : ''}
          ${m.from ? `<span>${U.esc(m.from)}</span>` : ''}${m.date ? `<span>${U.esc(m.date)}</span>` : ''}
        </div>
      </div>
      ${
        factChips.length || f.deadlines.length || f.links.length
          ? `<section class="cmsm-card"><h4>Key details</h4>
              ${factChips.length ? `<div class="cmsm-facts">${factChips.map(([i, x]) => chips([x], ICON[i])).join('')}</div>` : ''}
              ${f.deadlines.length ? `<ul class="cmsm-points">${f.deadlines.map((d) => `<li>${U.esc(d)}</li>`).join('')}</ul>` : ''}
              ${f.links.length ? `<div class="cmsm-links">${f.links.map((l) => `<a href="${U.esc(l)}" target="_blank" rel="noopener">${U.esc(l.replace(/^https?:\/\//, '').slice(0, 48))}</a>`).join('')}</div>` : ''}
            </section>`
          : ''
      }
      <section class="cmsm-card cmsm-ai"><h4>${ICON.spark}AI summary</h4>${aiHtml}</section>`;
  }

  function renderFavorites() {
    const list = Object.values(favorites).sort((a, b) => b.savedAt - a.savedAt);
    panel.querySelector('.cmsm-count').textContent = list.length || '';
    const q = panel.querySelector('.cmsm-favsearch input').value.trim().toLowerCase();
    const shown = list.filter((f) => !q || `${f.title} ${f.group} ${f.from} ${f.text}`.toLowerCase().includes(q));
    const box = panel.querySelector('.cmsm-favlist');
    if (!list.length) {
      box.innerHTML = `<div class="cmsm-empty">${ICON.star}<p>Star an email to keep it here, with its summary and full text.</p></div>`;
      return;
    }
    box.innerHTML =
      shown
        .map((f) => {
          const s = summaries[f.key];
          const open = expanded.has(f.key);
          return `<article class="cmsm-fav" data-key="${f.key}">
            <button type="button" class="cmsm-fav-main" data-act="expand" aria-expanded="${open}">
              <span class="cmsm-fav-title">${U.esc(f.title)}</span>
              <span class="cmsm-meta">${f.group ? `<span class="cmsm-chip">${U.esc(f.group)}</span>` : ''}<span>${U.esc(f.from || '')}</span><span>${U.esc(f.date || U.fmtDate(new Date(f.savedAt)))}</span></span>
              <span class="cmsm-fav-sum">${U.esc(s?.tldr || f.text.slice(0, 160))}</span>
            </button>
            ${open ? `<pre class="cmsm-fav-text">${U.esc(f.text)}</pre>` : ''}
            <div class="cmsm-fav-actions">
              <button type="button" class="cmsv-btn cmsv-btn-ghost cmsv-btn-sm" data-act="find">${ICON.search}<span>Find in Outlook</span></button>
              <button type="button" class="cmsv-btn cmsv-btn-ghost cmsv-btn-sm" data-act="unfav">Remove</button>
            </div>
          </article>`;
        })
        .join('') || '<div class="cmsm-empty"><p>No favorites match.</p></div>';
  }

  function render() {
    if (panel.hidden) return;
    panel.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    panel.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    renderEmail();
    renderFavorites();
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.hidden = open;
    document.documentElement.classList.toggle('cmsm-open', open);
    chrome.storage.sync.set({ mailPanelOpen: open });
    if (open) render();
  }

  // Type into Outlook's own search box so the user lands on the saved message.
  function findInOutlook(fav) {
    const text = fav.raw || fav.title;
    const box = [...document.querySelectorAll('input[aria-label*="search" i], input[placeholder*="search" i], input[type="search"]')].find(
      (el) => !el.closest('.cmsv') && visible(el)
    );
    navigator.clipboard?.writeText(fav.title).catch(() => {});
    if (!box) return U.toast('Subject copied. Paste it into Outlook’s search.');
    box.focus();
    box.click();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, fav.title);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    for (const type of ['keydown', 'keypress', 'keyup']) box.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    U.toast('Searching Outlook…');
  }

  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = t.dataset.tab;
      return render();
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fav = favorites[el.closest('[data-key]')?.dataset.key];
    switch (el.dataset.act) {
      case 'close':
        return setOpen(false);
      case 'fav':
        return current && toggleFavorite(current);
      case 'summarize':
        return summarize(current, true);
      case 'resummarize':
        return summarize(current, true);
      case 'copy': {
        const s = summaries[current?.key];
        if (!s) return;
        const lines = [current.title, s.tldr, s.when && `When: ${s.when}`, s.where && `Where: ${s.where}`, s.action && `To do: ${s.action}`, ...(s.key_points || []).map((p) => `• ${p}`)];
        navigator.clipboard.writeText(lines.filter(Boolean).join('\n')).then(() => U.toast('Summary copied'));
        return;
      }
      case 'expand':
        if (!fav) return;
        expanded.has(fav.key) ? expanded.delete(fav.key) : expanded.add(fav.key);
        return renderFavorites();
      case 'find':
        return fav && findInOutlook(fav);
      case 'unfav':
        if (!fav) return;
        delete favorites[fav.key];
        chrome.storage.local.set({ mailFavorites: favorites });
        return render();
    }
  });
  panel.querySelector('.cmsm-favsearch input').addEventListener('input', renderFavorites);
  launcher.addEventListener('click', () => setOpen(true));

  // ---------- Watching Outlook ----------

  let refreshTimer;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const msg = readOpenMessage();
      const changed = (msg?.key || null) !== (current?.key || null);
      current = msg;
      if (!changed) return;
      if (msg && summaries[msg.key]) Object.assign(ai, { key: msg.key, state: 'done' });
      render();
      if (msg && settings.aiAuto && !summaries[msg.key] && !panel.hidden) summarize(msg);
    }, 600);
  }

  const observer = new MutationObserver((records) => {
    let touched = false;
    for (const r of records) {
      if (r.target.closest?.('.cmsv') || r.target.parentElement?.closest('.cmsv')) continue;
      touched = true;
      if (r.type === 'characterData') fixTextNode(r.target);
      else r.addedNodes.forEach(fixSubtree);
    }
    if (!touched) return;
    dropStaleChips();
    scheduleRefresh();
  });

  async function start() {
    Object.assign(settings, await chrome.storage.sync.get(settings));
    await loadStore();
    fixSubtree(document.body);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    // On <html>, not <body>: the body is narrowed (and transformed) while the panel is open.
    document.documentElement.append(panel, launcher);
    setOpen(settings.mailPanelOpen);
    scheduleRefresh();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.mailShowGroup) {
      settings.mailShowGroup = changes.mailShowGroup.newValue;
      dropStaleChips();
    }
    if (changes.aiAuto) settings.aiAuto = changes.aiAuto.newValue;
  });

  start();
})();
