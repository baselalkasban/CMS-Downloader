// Text helpers for GUC mail: shorter subjects and quick facts pulled out of a message.
var CMSMail = (() => {
  const SEASON = /^(winter|spring|summer|fall|autumn)\s+\d{4}$/i;

  // "[EXTERNAL EMAIL] - Notification System: Tomorrows Math 501 tutorial [Group: Winter 2026 - MATH 501 - 5MET27 (Tutorial)]"
  //   -> { title: "Tomorrows Math 501 tutorial", group: "MATH 501 · 5MET27 (Tutorial)", fullGroup: "Winter 2026 - MATH 501 - 5MET27 (Tutorial)" }
  function cleanSubject(raw) {
    const original = String(raw || '').replace(/\s+/g, ' ').trim();
    // Keep reply/forward markers in front: "RE: [EXTERNAL EMAIL] - x" -> "RE: x".
    const lead = (/^(?:(?:re|fw|fwd)\s*:\s*)+/i.exec(original) || [''])[0];
    let s = original.slice(lead.length);
    let prev;
    do {
      prev = s;
      s = s
        .replace(/^\[\s*EXTERNAL(?:\s+EMAIL)?\s*\]\s*[-–—:|]?\s*/i, '')
        .replace(/^Notification\s+System\s*[:\-–—]\s*/i, '');
    } while (s !== prev);

    let fullGroup = null;
    const m = /\s*\[\s*Group\s*:\s*([^\]]+)\]\s*$/i.exec(s);
    if (m) {
      fullGroup = m[1].trim();
      s = s.slice(0, m.index).trim();
    }
    s = lead + s;
    const group = fullGroup
      ? fullGroup
          .split(/\s+[-–—]\s+/)
          .filter((p) => !SEASON.test(p.trim()))
          .join(' · ')
      : null;
    return { title: s || original, group, fullGroup, changed: (s || original) !== original };
  }

  // Subjects worth rewriting: anything the GUC systems decorate.
  const NOISY = /\[\s*EXTERNAL|Notification\s+System\s*:|\[\s*Group\s*:/i;
  const isNoisy = (text) => NOISY.test(text || '');

  const uniq = (arr) => [...new Set(arr.map((x) => x.trim()).filter(Boolean))];

  // Facts a student usually needs, found without AI: times, dates, rooms, links and deadline sentences.
  function extractFacts(text) {
    const t = String(text || '');
    const times = uniq(t.match(/\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s?(?:am|pm|a\.m\.|p\.m\.)(?=\W|$)|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/gi) || []);
    // "Second at c5.212" -> "2nd slot · C5.212"
    const ORD = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th' };
    const slots = uniq(
      [...t.matchAll(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b[^\n.,;]{0,24}?\b(?:at|in|@)\s+([A-Z]{1,2}\d{1,2}(?:\.\d{2,3})?[A-Z]?)\b/gi)].map(
        (m) => `${ORD[m[1].toLowerCase()] || m[1].toLowerCase()} slot · ${m[2].toUpperCase()}`
      )
    );
    const months = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
    const days = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight';
    const dates = uniq(
      t.match(
        new RegExp(
          `\\b(?:\\d{1,2}[\\/.-]\\d{1,2}(?:[\\/.-]\\d{2,4})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${months})(?:\\s+\\d{4})?|(?:${months})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|${days})\\b`,
          'gi'
        )
      ) || []
    ).filter((d) => !/^\d{1,2}[./-]\d{1,2}$/.test(d) || /\//.test(d)); // skip "5.212"-style room numbers
    const rooms = uniq([
      ...(t.match(/\b[A-Z]{1,2}\d{1,2}\.\d{2,3}[A-Z]?\b/gi) || []).map((r) => r.toUpperCase()),
      ...(t.match(/\b(?:hall|room|lab)\s+[A-Z]?\d+[A-Z]?\b/gi) || []).map((r) => r.replace(/^[a-z]/, (c) => c.toUpperCase())),
      ...[...t.matchAll(/\b(?:in|at)\s+([A-Z]{1,2}\d{1,3})\b(?!\.\d)/g)].map((m) => m[1]),
    ]);
    const links = uniq(t.match(/https?:\/\/[^\s<>"')]+/gi) || []).slice(0, 5);
    const deadlines = uniq(
      (t.match(/[^.!?\n]*\b(?:deadline|due|submit|submission|no later than|before|until|postponed|cancel(?:l)?ed|quiz|exam|midterm|final)\b[^.!?\n]*[.!?]?/gi) || [])
        .map((s) => s.trim())
        .filter((s) => s.length > 12 && s.length < 220)
    ).slice(0, 4);
    return { times, slots, dates: uniq(dates).slice(0, 6), rooms, links, deadlines };
  }

  // Short stable key for a message, used for favorites and cached summaries.
  function messageKey(subject, from, body) {
    const s = `${subject}|${from}|${String(body || '').replace(/\s+/g, ' ').slice(0, 300)}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // Automated senders that sign the real author at the bottom of the email.
  const isSystemSender = (name, email) =>
    /notification\s+system|do\s+not\s+reply|no-?reply/i.test(name || '') || /^(?:notify|noreply|no-reply|donotreply)@/i.test(email || '');

  // The signer of an email: the lines after the last "-----" line, e.g.
  // "Ms. Mai Adel Mohamed Ibrahim" + "Department: Mathematics" -> "Ms. Mai Adel Mohamed Ibrahim · Mathematics".
  function signature(text) {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const sep = lines.map((l) => /^[-_=*~]{4,}$/.test(l)).lastIndexOf(true);
    let sig = [];
    if (sep >= 0 && sep < lines.length - 1) sig = lines.slice(sep + 1, sep + 3);
    else {
      const i = lines.findIndex((l, k) => k >= lines.length - 5 && /^(?:dr|prof|eng|mr|mrs|ms|miss)\.?\s+\S/i.test(l));
      if (i >= 0) sig = lines.slice(i, i + 2);
    }
    sig = sig.filter((l) => l.length <= 90);
    if (!sig.length || /^(?:thank|regards|best|sincerely)/i.test(sig[0])) return null;
    const name = sig[0].replace(/[,.]$/, '');
    const role =
      sig[1] && /department|dept|faculty|instructor|lecturer|teaching|assistant|professor|coordinator|office|unit/i.test(sig[1])
        ? sig[1].replace(/^(?:department|dept)\.?\s*(?:of|[:\-–])\s*/i, '').trim()
        : null;
    return { name, role, label: role ? `${name} · ${role}` : name };
  }

  // In narrow places (the message list) the name alone.
  const shortPerson = (label) => String(label || '').split(' · ')[0];

  return { cleanSubject, isNoisy, extractFacts, messageKey, isSystemSender, signature, shortPerson };
})();
