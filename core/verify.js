// Build-time evidence checks — docs/API.md §3. verifyProgram(record, pageTexts) → string[] ("<json path>: <reason>").
//
// pageTexts maps a source id to its page text, or to { text, sha256, text_sha256 } where the hashes were computed
// from the saved file (the caller reads files; core has no file system). A source id missing from pageTexts means
// the saved file is missing.

import { validateProgram, BOUND_KINDS } from './schema.js';
import { numbersIn } from './text.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

/** Every quote in a record: [{ path, quote, source }], in a stable order. */
export function quotesOf(record) {
  const out = [];
  const add = (path, obj) => {
    if (obj && typeof obj === 'object' && typeof obj.quote === 'string') out.push({ path: `${path}.quote`, quote: obj.quote, source: obj.source });
  };
  add('summary', record.summary);
  (record.funding_types ?? []).forEach((f, i) => add(`funding_types[${i}]`, f));
  add('intake', record.intake);
  add('intake.deadline', record.intake?.deadline);
  add('max_amount', record.max_amount);
  add('cost_share', record.cost_share);
  (record.criteria ?? []).forEach((c, i) => add(`criteria[${i}]`, c));
  (record.contacts ?? []).forEach((c, i) => add(`contacts[${i}]`, c));
  return out;
}

function entryText(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.text === 'string') return entry.text;
  return null;
}

/** Where a quote stops matching the page: the longest prefix of the quote found in the text. */
function longestPrefixFound(text, quote) {
  let lo = 0;
  let hi = quote.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (text.includes(quote.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function verifyProgram(record, pageTexts = {}) {
  const problems = validateProgram(record);
  const bad = (path, reason) => problems.push(`${path}: ${reason}`);
  if (!record || typeof record !== 'object') return problems;

  const texts = {};
  (Array.isArray(record.sources) ? record.sources : []).forEach((s, i) => {
    if (!s || typeof s.id !== 'string') return;
    const entry = pageTexts[s.id];
    const text = entryText(entry);
    if (text === null) {
      bad(`sources[${i}]`, `the saved page data/sources/${s.id}.html is missing`);
      return;
    }
    texts[s.id] = text;
    if (entry && typeof entry === 'object') {
      if (entry.sha256 !== undefined && entry.sha256 !== s.sha256) {
        bad(`sources[${i}].sha256`, `does not match the saved file (file is ${entry.sha256})`);
      }
      if (entry.text_sha256 !== undefined && entry.text_sha256 !== s.text_sha256) {
        bad(`sources[${i}].text_sha256`, `does not match the saved file’s page text (it is ${entry.text_sha256})`);
      }
    }
  });

  for (const { path, quote, source } of quotesOf(record)) {
    const text = texts[source];
    if (text === undefined) continue; // unknown or missing source: already reported
    if (!text.includes(quote)) {
      const n = longestPrefixFound(text, quote);
      const where = n === 0
        ? 'not even its first character matches'
        : `it matches up to character ${n}, then the page has something else after “${quote.slice(Math.max(0, n - 30), n)}”`;
      bad(path, `this quote is not in the page text of ${source} (${where})`);
    }
  }

  (record.criteria ?? []).forEach((c, i) => {
    if (!c || !c.rule || !BOUND_KINDS.includes(c.rule.kind) || typeof c.quote !== 'string') return;
    const nums = numbersIn(c.quote);
    for (const b of ['gte', 'gt', 'lte', 'lt']) {
      if (typeof c.rule[b] === 'number' && !nums.includes(c.rule[b])) {
        bad(`criteria[${i}].rule.${b}`, `${c.rule[b]} is not written in this criterion’s quote`);
      }
    }
  });

  const m = record.max_amount;
  if (m && typeof m.amount === 'number' && typeof m.quote === 'string' && !numbersIn(m.quote).includes(m.amount)) {
    bad('max_amount.amount', `${m.amount} is not written in its quote`);
  }
  const cs = record.cost_share;
  if (cs && typeof cs.percent === 'number' && typeof cs.quote === 'string' && !numbersIn(cs.quote).includes(cs.percent)) {
    bad('cost_share.percent', `${cs.percent} is not written in its quote`);
  }

  const d = record.intake?.deadline;
  if (d && typeof d.date === 'string' && typeof d.quote === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
    if (!d.quote.includes(d.date)) {
      const [, mm, dd] = d.date.split('-').map(Number);
      const month = MONTHS[mm - 1];
      const hasDay = numbersIn(d.quote).includes(dd);
      const hasMonth = month !== undefined && new RegExp(`\\b(${month}|${month.slice(0, 3)})\\b`, 'i').test(d.quote);
      if (!hasDay || !hasMonth) {
        bad('intake.deadline.date', `${d.date} is not written in its quote (needs the day ${dd} and ${month ?? 'the month'}, or the ISO date)`);
      }
    }
  }

  (record.contacts ?? []).forEach((c, i) => {
    if (!c || typeof c.quote !== 'string') return;
    if (typeof c.phone === 'string') {
      const phoneDigits = c.phone.replace(/\D/g, '');
      if (!c.quote.replace(/\D/g, '').includes(phoneDigits)) bad(`contacts[${i}].phone`, `${c.phone} is not written in its quote`);
    }
    if (typeof c.email === 'string' && !c.quote.includes(c.email)) bad(`contacts[${i}].email`, `${c.email} is not written in its quote`);
  });

  return problems;
}
