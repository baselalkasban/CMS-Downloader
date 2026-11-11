// GUC Outlook (mail.guc.edu.eg): short subjects, plus a Mail assistant panel with key details,
// a local-AI summary and favorites. Outlook's markup isn't relied on: subjects are found by their text
// and the open message through its "Message body" accessibility label (with fallbacks).
(() => {
  if (window.top !== window) return; // Outlook embeds frames; run once, in the main page
  const U = CMSUI;
  const M = CMSMail;
  const settings = { mailShowGroup: true, mailPanelOpen: true, mailSkin: true, aiAuto: true, aiModel: '' };

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
  // Found by layout, not by Outlook's markup: the subject is the biggest text on the right of the screen,
  // the sender and date sit just under it, and the body is the largest block of text below those.

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const fontSize = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
  const LABELLED_BODY = '[aria-label="Message body" i], [aria-label="Message contents" i], div[role="document"], [id^="Item.MessageUniqueBody"], [id^="Item.MessagePartBody"]';
  const DATE_RE = /\b(?:today|yesterday|mon|tue|wed|thu|fri|sat|sun)\w*\b[^\n]{0,20}\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i;

  // The reading pane's subject: a subject we shortened, or else the largest text right of the message list.
  function findSubjectEl() {
    const minLeft = innerWidth * 0.22;
    const ours = [...document.querySelectorAll('[data-cmsm-subject]')].filter(
      (el) => !el.closest('.cmsv') && visible(el) && el.getBoundingClientRect().left > minLeft && el.textContent.includes(el.dataset.cmsmTitle)
    );
    let best = null;
    let bestSize = 0;
    for (const el of ours) {
      const size = fontSize(el);
      if (size > bestSize) [best, bestSize] = [el, size];
    }
    if (best && bestSize >= 16) return best;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const text = n.data.trim();
      const el = n.parentElement;
      if (text.length < 2 || text.length > 300 || !el || el.closest(SKIP)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < minLeft || r.top < 30 || r.top > innerHeight * 0.6 || !r.width) continue;
      const size = fontSize(el);
      if (size > bestSize + 0.5) [best, bestSize] = [el, size];
    }
    return bestSize >= 16 ? best : null;
  }

  function readByLayout() {
    const subjectEl = findSubjectEl();
    if (!subjectEl) return null;
    const sr = subjectEl.getBoundingClientRect();
    let pane = subjectEl;
    while (pane.parentElement && pane !== document.body) {
      pane = pane.parentElement;
      const r = pane.getBoundingClientRect();
      if (r.height > 260 && r.width > 320 && pane.textContent.length > subjectEl.textContent.length + 40) break;
    }
    // Header lines (sender, date) right under the subject.
    const header = [];
    const walker = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      const text = n.data.trim();
      if (!text || !el || el.closest(SKIP) || subjectEl.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < sr.top - 4 || r.top > sr.bottom + 140 || !r.width) continue;
      header.push({ el, text, r });
    }
    // Only short lines near the sender's address count: a body may also contain times and addresses.
    const short = header.filter((h) => h.text.length < 90);
    const fromTop = short.find((h) => /@[\w.-]+\.\w+/.test(h.text))?.r.top ?? sr.bottom;
    const headerLines = short.filter((h) => h.r.top < fromTop + 50);
    const headerBottom = Math.max(sr.bottom, ...headerLines.filter((h) => /@|\d{1,2}:\d{2}/.test(h.text)).map((h) => h.r.bottom));
    // Body: the element below the header holding the most text.
    let body = null;
    let most = 0;
    for (const el of pane.querySelectorAll('div, td, article, section')) {
      if (el.contains(subjectEl) || el.closest(SKIP)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < headerBottom - 2 || r.height < 12 || r.width < 120) continue;
      const len = el.textContent.trim().length;
      if (len > most) [body, most] = [el, len];
    }
    if (!body) return null;
    return { subjectEl, body, header: headerLines };
  }

  function readOpenMessage() {
    let found = null;
    const labelled = [...document.querySelectorAll(LABELLED_BODY)].find((el) => !el.closest('.cmsv') && visible(el) && el.innerText.trim());
    found = readByLayout();
    if (labelled && (!found || !found.body.contains(labelled))) found = found ? { ...found, body: labelled } : null;
    if (!found) return null;
    const { subjectEl, body, header } = found;
    // Our saved original subject only counts while the element still shows it (Outlook reuses elements).
    const holder = subjectEl.closest('[data-cmsm-subject]');
    const ownText = [...subjectEl.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.data).join('').replace(/\s+/g, ' ').trim();
    const raw = holder && holder.textContent.includes(holder.dataset.cmsmTitle) ? holder.dataset.cmsmSubject : ownText || subjectEl.textContent.replace(/\s+/g, ' ').trim();
    const text = body.innerText.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    // "GUC Notification System (DO NOT REPLY) <notify@guc.edu.eg>" is often split into pieces: read whole lines.
    const fromLine = header.find((h) => /@[\w.-]+\.\w+/.test(h.text));
    const fromBlockText = (fromLine?.el.closest('div, p, li, td, span[title]') || fromLine?.el)?.innerText || '';
    const fromText = fromBlockText.split('\n').find((l) => l.includes('@')) || fromLine?.text || '';
    const email = (/[\w.+-]+@[\w.-]+\.\w+/.exec(fromText) || [''])[0];
    let from = fromText.replace(/<[^>]*>/, '').replace(email, '').trim();
    if (!from) from = header.find((h) => h !== fromLine && !DATE_RE.test(h.text) && !/@/.test(h.text) && h.text.length > 3)?.text || email;
    const date = header.find((h) => DATE_RE.test(h.text))?.text || '';
    const subject = M.cleanSubject(raw);
    const person = M.isSystemSender(from, email) ? M.signature(text) : null;
    return {
      key: M.messageKey(raw, email || from, text),
      raw,
      title: subject.title || '(no subject)',
      group: subject.group,
      fullGroup: subject.fullGroup,
      from: person ? person.label : from,
      // Once relabelled, the page shows the signer, so name the system sender explicitly.
      systemFrom: person ? (M.isSystemSender(from, '') ? from : 'GUC Notification System') : null,
      person,
      email,
      date,
      text,
      header,
    };
  }

  // Fallback when the email can't be found on the page: the text the user selected.
  function readSelection() {
    const text = String(getSelection() || '').trim();
    if (text.length < 20) return null;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const subject = M.cleanSubject(lines[0]);
    const person = M.signature(text);
    return { key: M.messageKey(lines[0], '', text), raw: lines[0], title: subject.title, group: subject.group, fullGroup: subject.fullGroup, from: person?.label || '', email: '', date: '', text, header: [], person };
  }

  // ---------- Real senders for "GUC Notification System" emails ----------
  // Those emails are signed by the actual sender after a "-----" line; show that person instead.

  let senders = {}; // raw subject -> person label, learned from emails that were opened
  const senderNodes = new Map(); // text node -> original text, for nodes we relabelled

  function relabel(node, label) {
    if (!senderNodes.has(node)) senderNodes.set(node, node.data);
    if (node.data !== label) node.data = label;
  }

  // Reading pane: replace the system name next to the address with the signer.
  function relabelHeader(msg) {
    if (!msg?.person) return;
    for (const h of msg.header) {
      const n = [...h.el.childNodes].find((c) => c.nodeType === Node.TEXT_NODE && (/notification system/i.test(c.data) || senderNodes.has(c)));
      if (n) relabel(n, msg.person.label);
    }
  }

  // Message list: rows show the system name; use the signer learned when that email was opened.
  function relabelList() {
    for (const [node, original] of senderNodes) if (!node.isConnected) senderNodes.delete(node);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/notification system/i.test(n.data) || senderNodes.has(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest(SKIP)) continue;
      if (current?.header.some((h) => h.el.contains(node))) continue; // reading pane handled above
      let row = node.parentElement;
      let subjectEl = null;
      for (let i = 0; i < 7 && row && !subjectEl; i++, row = row.parentElement) subjectEl = row.querySelector('[data-cmsm-subject]');
      const raw = subjectEl?.textContent.includes(subjectEl.dataset.cmsmTitle) ? subjectEl.dataset.cmsmSubject : null;
      const label = raw && senders[raw];
      if (label) relabel(node, M.shortPerson(label));
      else if (senderNodes.has(node) && node.data !== senderNodes.get(node)) node.data = senderNodes.get(node); // row reused for another email
    }
  }

  function learnSender(msg) {
    if (!msg?.person || senders[msg.raw] === msg.person.label) return;
    senders[msg.raw] = msg.person.label;
    const keys = Object.keys(senders);
    if (keys.length > 500) delete senders[keys[0]];
    chrome.storage.local.set({ mailSenders: senders });
  }

  // ---------- Storage: favorites and cached summaries ----------

  let favorites = {}; // key -> saved message
  let summaries = {}; // key -> AI summary

  async function loadStore() {
    ({ mailFavorites: favorites = {}, mailSummaries: summaries = {}, mailSenders: senders = {} } = await chrome.storage.local.get(['mailFavorites', 'mailSummaries', 'mailSenders']));
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
      pane.innerHTML = `<div class="cmsm-empty">${ICON.spark}<p>Open an email to see its key details and an AI summary here.</p>
        <p class="cmsm-hint">Not picked up? Select the email's text, then click:</p>
        <button type="button" class="cmsv-btn cmsv-btn-ghost cmsv-btn-sm" data-act="use-selection">Use selected text</button></div>`;
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
          ${m.from ? `<span class="cmsm-from">${U.esc(m.from)}</span>` : ''}${m.date ? `<span>${U.esc(m.date)}</span>` : ''}
          ${m.systemFrom ? `<span class="cmsm-via">via ${U.esc(m.systemFrom.replace(/\s*\(do not reply\)/i, ''))}</span>` : ''}
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
      case 'use-selection': {
        const msg = readSelection();
        if (!msg) return U.toast('Select the email text first (at least a sentence).');
        current = { ...msg, fromSelection: true };
        render();
        if (settings.aiAuto && !summaries[current.key]) summarize(current);
        return;
      }
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
      const found = readOpenMessage();
      // Keep a message picked from the selection until a real one is found on the page.
      const msg = found || (current?.fromSelection ? current : null);
      const changed = (msg?.key || null) !== (current?.key || null);
      current = msg;
      if (msg && !msg.fromSelection) {
        learnSender(msg);
        relabelHeader(msg);
      }
      relabelList();
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
  addEventListener('resize', () => keepDarkBars());

  // Outlook in the extension's theme: dark themes repaint Outlook dark (see mail.css).
  const applySkin = () => {
    document.documentElement.classList.toggle('cmsm-skin', settings.mailSkin !== false);
    keepDarkBars();
  };

  // Outlook's top bar is already dark: mark it so the repaint leaves it dark.
  function keepDarkBars() {
    const luminance = (el) => {
      const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
      return m && (m[4] === undefined || +m[4] > 0.5) ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : null;
    };
    for (const el of document.elementsFromPoint(innerWidth / 3, 12)) {
      if (el === document.body || el === document.documentElement || el.closest('.cmsv')) continue;
      const lum = luminance(el);
      if (lum === null) continue;
      if (lum < 0.25 && el.getBoundingClientRect().width > innerWidth * 0.4) el.classList.add('cmsm-keep');
      break;
    }
  }

  async function start() {
    Object.assign(settings, await chrome.storage.sync.get(settings));
    applySkin();
    await loadStore();
    fixSubtree(document.body);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    // On <html>, not <body>: the body is narrowed (and transformed) while the panel is open.
    document.documentElement.append(panel, launcher);
    setOpen(settings.mailPanelOpen);
    scheduleRefresh();
    setTimeout(keepDarkBars, 1500); // Outlook builds its header after load
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.mailShowGroup) {
      settings.mailShowGroup = changes.mailShowGroup.newValue;
      dropStaleChips();
    }
    if (changes.aiAuto) settings.aiAuto = changes.aiAuto.newValue;
    if (changes.mailSkin) {
      settings.mailSkin = changes.mailSkin.newValue;
      applySkin();
    }
  });

  start();
})();
