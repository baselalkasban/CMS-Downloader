// Adds a type / week / search filter bar to CMS course pages.
(() => {
  const weeks = [...document.querySelectorAll('.weeksdata')];
  if (!weeks.length) return;

  // "Lab manual" -> "Lab Manual"; leaves mixed-case words such as "VoD" alone.
  const titleCase = (s) =>
    s.split(/\s+/).map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

  const items = [];
  for (const week of weeks) {
    const heading = week.querySelector('h2')?.textContent || '';
    const date = (/(\d{4})-(\d{1,2})-(\d{1,2})/.exec(heading) || []).slice(1).map(Number);
    week.dataset.cmsfDate = date.length ? date.join('-') : heading.trim();
    for (const label of week.querySelectorAll('[id^="content"]')) {
      const strong = label.querySelector('strong');
      if (!strong) continue;
      const type = (/\(([^()]*)\)\s*$/.exec(label.textContent.replace(strong.textContent, '')) || [])[1];
      items.push({
        card: label.closest('.card') || label.parentElement,
        week,
        title: strong.textContent.replace(/^\s*\d+\s*-\s*/, '').trim(),
        type: titleCase((type || 'Other').trim()) || 'Other',
      });
    }
  }
  if (!items.length) return;

  const count = (list, key) => list.reduce((m, i) => m.set(i[key], (m.get(i[key]) || 0) + 1), new Map());
  const types = [...count(items, 'type')].sort((a, b) => a[0].localeCompare(b[0]));
  const weekDates = [...new Set(weeks.map((w) => w.dataset.cmsfDate))].sort((a, b) => {
    const [x, y] = [a, b].map((d) => new Date(d.replace(/-/g, '/')).getTime() || 0);
    return y - x;
  });
  const fmt = (d) => {
    const t = new Date(d.replace(/-/g, '/'));
    return isNaN(t) ? d : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const itemsInWeek = (d) => items.filter((i) => i.week.dataset.cmsfDate === d).length;

  const bar = document.createElement('div');
  bar.className = 'cmsf';
  bar.innerHTML = `
    <div class="cmsf-row">
      <label class="cmsf-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search files…  ( / )" aria-label="Search files" />
      </label>
      <select aria-label="Filter by week">
        <option value="">All weeks (${weekDates.length})</option>
        ${weekDates.map((d) => `<option value="${d}">Week of ${fmt(d)} · ${itemsInWeek(d)}</option>`).join('')}
      </select>
      <button type="button" class="cmsf-reset" hidden>Reset</button>
      <div class="cmsf-count"></div>
    </div>
    <div class="cmsf-row cmsf-types">
      <span class="cmsf-label">Type</span>
      <button type="button" class="cmsf-chip" data-type="" aria-pressed="true">All <span>${items.length}</span></button>
      ${types.map(([t, n]) => `<button type="button" class="cmsf-chip" data-type="${t}" aria-pressed="false">${t} <span>${n}</span></button>`).join('')}
    </div>
    <div class="cmsf-empty" hidden>No files match these filters.</div>`;

  const search = bar.querySelector('input');
  const weekSelect = bar.querySelector('select');
  const reset = bar.querySelector('.cmsf-reset');
  const chips = [...bar.querySelectorAll('.cmsf-chip')];
  const selected = new Set();

  function apply() {
    const q = search.value.trim().toLowerCase();
    const week = weekSelect.value;
    const shownWeeks = new Set();
    let shown = 0;
    for (const i of items) {
      const ok =
        (!selected.size || selected.has(i.type)) &&
        (!week || i.week.dataset.cmsfDate === week) &&
        (!q || i.title.toLowerCase().includes(q));
      i.card.classList.toggle('cmsf-hide', !ok);
      if (ok) {
        shown++;
        shownWeeks.add(i.week);
      }
    }
    const filtering = Boolean(q || week || selected.size);
    for (const w of weeks) w.classList.toggle('cmsf-hide', filtering && !shownWeeks.has(w));
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.type ? selected.has(c.dataset.type) : !selected.size));
    bar.querySelector('.cmsf-count').innerHTML = `<b>${shown}</b> of ${items.length} files`;
    bar.querySelector('.cmsf-empty').hidden = shown > 0;
    reset.hidden = !filtering;
  }

  for (const c of chips) {
    c.addEventListener('click', () => {
      const t = c.dataset.type;
      if (!t) selected.clear();
      else if (selected.has(t)) selected.delete(t);
      else selected.add(t);
      apply();
    });
  }
  search.addEventListener('input', apply);
  weekSelect.addEventListener('change', apply);
  reset.addEventListener('click', () => {
    search.value = '';
    weekSelect.value = '';
    selected.clear();
    apply();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName)) {
      e.preventDefault();
      search.focus();
    }
  });

  const anchor = document.querySelector('[id$="_Filter"]') || weeks[0];
  anchor.parentElement.insertBefore(bar, anchor);
  apply();
})();
