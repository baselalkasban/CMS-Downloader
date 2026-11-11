// Local AI (Ollama, LM Studio, llama.cpp, Jan… anything with an OpenAI-compatible API on this computer).
// Mail text only ever goes to the local server the user configured.

const AI_DEFAULTS = { aiUrl: 'http://localhost:11434', aiModel: '', aiAuto: true };
const AI_RULE_ID = 4242;

// Ollama rejects requests that carry a browser-extension Origin header unless OLLAMA_ORIGINS is set.
// Requests from this extension's background (no tab) to localhost go out without it instead.
chrome.declarativeNetRequest
  .updateSessionRules({
    removeRuleIds: [AI_RULE_ID],
    addRules: [
      {
        id: AI_RULE_ID,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] },
        condition: { requestDomains: ['localhost', '127.0.0.1'], tabIds: [chrome.tabs.TAB_ID_NONE], resourceTypes: ['xmlhttprequest', 'other'] },
      },
    ],
  })
  .catch((e) => console.warn('CMS Downloader: could not set the local AI header rule', e));

const aiBase = (url) => String(url || AI_DEFAULTS.aiUrl).trim().replace(/\/+$/, '').replace(/\/v1$/, '');

async function aiFetch(path, init = {}, timeoutMs = 120000) {
  const { aiUrl } = await chrome.storage.sync.get(AI_DEFAULTS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(aiBase(aiUrl) + path, { ...init, signal: ctrl.signal });
    if (res.status === 403) throw new Error('The local AI refused the request (403). In Ollama, set OLLAMA_ORIGINS=chrome-extension://* and restart it.');
    if (!res.ok) throw new Error(`The local AI answered ${res.status} ${res.statusText}.`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The local AI took too long to answer.');
    if (e instanceof TypeError) throw new Error(`Can't reach a local AI at ${aiBase(aiUrl)}. Is Ollama or LM Studio running?`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function aiModels() {
  try {
    const data = await aiFetch('/v1/models', {}, 8000);
    const ids = (data.data || []).map((m) => m.id).filter(Boolean);
    if (ids.length) return ids;
  } catch (e) {
    if (!/answered 404/.test(e.message)) throw e;
  }
  const tags = await aiFetch('/api/tags', {}, 8000); // older Ollama
  return (tags.models || []).map((m) => m.name);
}

async function aiChat(messages) {
  let { aiModel } = await chrome.storage.sync.get(AI_DEFAULTS);
  if (!aiModel) {
    [aiModel] = await aiModels();
    if (!aiModel) throw new Error('No model is installed in your local AI. In Ollama, run: ollama pull llama3.2');
  }
  const data = await aiFetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: aiModel, messages, temperature: 0.2, stream: false }),
  });
  return { text: data.choices?.[0]?.message?.content || '', model: aiModel };
}

const SUMMARY_PROMPT = `You summarize university emails for a busy student at the German University in Cairo.
Reply with JSON only, no other text, in this shape:
{"tldr": "one sentence, max 25 words", "when": "date/time or null", "where": "place/room or null", "action": "what the student must do, with any deadline, or null", "key_points": ["up to 4 short points"]}
Use only facts written in the email. Keep room codes, times and course codes exactly as written.`;

// Models sometimes wrap JSON in prose or code fences; take the first object we can parse.
function parseSummary(text) {
  const match = /\{[\s\S]*\}/.exec(text);
  if (match) {
    try {
      const o = JSON.parse(match[0]);
      const str = (v) => (typeof v === 'string' && v.trim() && !/^null$/i.test(v.trim()) ? v.trim() : null);
      return {
        tldr: str(o.tldr) || str(o.summary),
        when: str(o.when),
        where: str(o.where),
        action: str(o.action),
        key_points: Array.isArray(o.key_points) ? o.key_points.map(str).filter(Boolean).slice(0, 5) : [],
      };
    } catch {}
  }
  return { tldr: text.trim().slice(0, 600), when: null, where: null, action: null, key_points: [] };
}

async function aiSummarize({ subject, from, date, text }) {
  const body = String(text || '').replace(/\n{3,}/g, '\n\n').slice(0, 6000);
  const { text: reply, model } = await aiChat([
    { role: 'system', content: SUMMARY_PROMPT },
    { role: 'user', content: `Subject: ${subject}\nFrom: ${from || 'unknown'}\nDate: ${date || 'unknown'}\n\n${body}` },
  ]);
  return { ...parseSummary(reply), model };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = { 'ai-models': aiModels, 'ai-summarize': () => aiSummarize(msg) };
  const handler = handlers[msg?.type];
  if (!handler) return;
  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true; // answer asynchronously
});
