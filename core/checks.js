// Live re-checks of the saved source pages — docs/API.md §9. Pure ESM; fetch and sleep are passed in.

import { pageText } from './text.js';
import { sha256Hex } from './hash.js';
import { quotesOf } from './verify.js';

export const USER_AGENT = 'APCO-Software-Tools-research/1.0 (+https://apcosoftwaretools.ca)';
export const MIN_DELAY_MS = 1000;
export const TIMEOUT_MS = 20000;

// ---- robots.txt ----------------------------------------------------------------------------------------------

/** Parse robots.txt into groups: [{ agents: [lowercase], rules: [{ allow, pattern }], crawlDelay }]. */
function parseRobots(txt) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of String(txt ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value !== '') current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = Math.max(current.crawlDelay ?? 0, n);
    }
  }
  return groups;
}

/** The groups that apply to a User-Agent: every group naming our product token, else every `*` group. */
function groupsFor(txt, ua) {
  const groups = parseRobots(txt);
  const token = String(ua).split('/')[0].trim().toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && (token === a || token.startsWith(a))));
  return specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
}

function patternToRegExp(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** robotsAllows(txt, ua, path) — `path` includes the query string. Longest matching rule wins; a tie allows. */
export function robotsAllows(txt, ua, path) {
  let best = null;
  for (const g of groupsFor(txt, ua)) {
    for (const r of g.rules) {
      if (!patternToRegExp(r.pattern).test(path)) continue;
      const len = r.pattern.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
    }
  }
  return best ? best.allow : true;
}

/** Crawl-delay in seconds for our User-Agent, or null. */
export function robotsCrawlDelay(txt, ua) {
  let delay = null;
  for (const g of groupsFor(txt, ua)) if (g.crawlDelay !== null) delay = Math.max(delay ?? 0, g.crawlDelay);
  return delay;
}

// ---- running a check -----------------------------------------------------------------------------------------

function mapOrigin(url, originMap) {
  if (!originMap) return url;
  const u = new URL(url);
  const to = originMap[u.origin];
  return to ? `${to.replace(/\/$/, '')}${u.pathname}${u.search}` : url;
}

/**
 * runChecks({ programs, fetch, sleep, now, only, onRaw, log, originMap, trigger }) → ChecksResult
 * Sources are checked one at a time, in program then source order.
 */
export async function runChecks({
  programs, fetch, sleep, now = () => new Date(), only = null, onRaw = null, log = () => {}, originMap = null,
  trigger = 'node',
}) {
  const started_at = now().toISOString();
  const hosts = new Map(); // origin → { robots: { status, txt } | null, lastAt: ms | null, delayMs }
  const wanted = only ? new Set(only) : null;
  const out = [];

  async function politeFetch(host, url) {
    if (host.lastAt !== null) {
      const wait = host.delayMs - (now().getTime() - host.lastAt);
      if (wait > 0) await sleep(wait);
    }
    host.lastAt = now().getTime();
    const init = { method: 'GET', headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(TIMEOUT_MS);
    try {
      return await fetch(url, init);
    } finally {
      host.lastAt = now().getTime();
    }
  }

  async function hostFor(origin) {
    let host = hosts.get(origin);
    if (host) return host;
    host = { robots: null, lastAt: null, delayMs: MIN_DELAY_MS };
    hosts.set(origin, host);
    try {
      const res = await politeFetch(host, `${origin}/robots.txt`);
      const txt = await res.text();
      if (res.status >= 200 && res.status < 300) host.robots = { kind: 'rules', txt };
      else if (res.status >= 400 && res.status < 500) host.robots = { kind: 'none' }; // no robots.txt: everything allowed
      else host.robots = { kind: 'unreachable', error: `robots.txt answered HTTP ${res.status}` };
    } catch (e) {
      host.robots = { kind: 'unreachable', error: `robots.txt could not be read (${e?.message ?? e})` };
    }
    if (host.robots.kind === 'rules') {
      const cd = robotsCrawlDelay(host.robots.txt, USER_AGENT);
      if (cd !== null) host.delayMs = Math.max(MIN_DELAY_MS, cd * 1000);
    }
    return host;
  }

  for (const program of programs) {
    if (wanted && !wanted.has(program.slug)) continue;
    const quotes = quotesOf(program);
    for (const source of program.sources) {
      const own = quotes.filter((q) => q.source === source.id);
      const entry = {
        source_id: source.id, program_slug: program.slug, url: source.url, ok: false, error: null, http_status: null,
        fetched_at: null, sha256: null, text_sha256: null, changed: false,
        quotes_total: own.length, quotes_found: 0, missing: [],
      };
      out.push(entry);

      const target = mapOrigin(source.url, originMap);
      const t = new URL(target);
      const host = await hostFor(t.origin);
      if (host.robots.kind === 'unreachable') {
        entry.error = `${host.robots.error}, so the page was not fetched`;
        log(`${source.id}: ${entry.error}`);
        continue;
      }
      if (host.robots.kind === 'rules' && !robotsAllows(host.robots.txt, USER_AGENT, `${t.pathname}${t.search}`)) {
        entry.error = 'robots.txt disallows';
        log(`${source.id}: robots.txt disallows ${source.url}`);
        continue;
      }

      let res;
      let bytes;
      try {
        res = await politeFetch(host, target);
        bytes = new Uint8Array(await res.arrayBuffer());
      } catch (e) {
        entry.error = `could not fetch the page (${e?.name === 'TimeoutError' ? 'timed out' : e?.message ?? e})`;
        entry.fetched_at = now().toISOString();
        log(`${source.id}: ${entry.error}`);
        continue;
      }
      entry.fetched_at = now().toISOString();
      entry.http_status = res.status;
      entry.sha256 = await sha256Hex(bytes);
      if (onRaw) await onRaw({ source_id: source.id, url: source.url, fetched_at: entry.fetched_at, http_status: res.status, body: bytes });

      if (res.status !== 200) {
        // The page answered but is not there: none of its quotes can be confirmed.
        entry.error = `the page answered HTTP ${res.status}`;
        entry.missing = own.map((q) => ({ path: q.path, quote: q.quote }));
        log(`${source.id}: ${entry.error}`);
        continue;
      }
      const text = pageText(new TextDecoder('utf-8').decode(bytes));
      entry.text_sha256 = await sha256Hex(text);
      entry.changed = entry.text_sha256 !== source.text_sha256;
      entry.missing = own.filter((q) => !text.includes(q.quote)).map((q) => ({ path: q.path, quote: q.quote }));
      entry.quotes_found = own.length - entry.missing.length;
      entry.ok = true;
      log(`${source.id}: ${entry.quotes_found}/${entry.quotes_total} quotes found${entry.changed ? ', page text changed' : ''}`);
    }
  }

  return { started_at, finished_at: now().toISOString(), trigger, sources: out };
}

/** sourceStatusFrom(runs) — runs oldest first → { [source_id]: { last_checked_at, last_ok, last_verified_at, missing_quotes } } */
export function sourceStatusFrom(runs) {
  const status = {};
  for (const run of runs ?? []) {
    for (const s of run.sources ?? []) {
      const prev = status[s.source_id] ?? { last_checked_at: null, last_ok: null, last_verified_at: null, missing_quotes: 0 };
      const checkedAt = s.fetched_at ?? run.finished_at ?? null;
      const missing = Array.isArray(s.missing) ? s.missing.length : 0;
      let lastVerified = prev.last_verified_at;
      if (s.ok && missing === 0 && s.fetched_at && (lastVerified === null || s.fetched_at > lastVerified)) lastVerified = s.fetched_at;
      status[s.source_id] = { last_checked_at: checkedAt, last_ok: Boolean(s.ok), last_verified_at: lastVerified, missing_quotes: missing };
    }
  }
  return status;
}
