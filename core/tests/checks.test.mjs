// runChecks against a SAMPLE fixture HTTP server on GM_FIXTURE_PORT (default 7403), reached through originMap.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runChecks, robotsAllows, robotsCrawlDelay, sourceStatusFrom, USER_AGENT } from '../checks.js';
import { evaluateProgram } from '../match.js';
import { samplePrograms, sampleHtml, profileFrom, AUTO_QUERY, NOW } from './helpers.mjs';

const PORT = Number(process.env.GM_FIXTURE_PORT || 7403);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const REMOVED_QUOTE = 'Projects costing at least $10,000';

// What the server answers; each test sets it.
const site = { robots: '', status: 200, pages: new Map(), overrides: new Map() };
const requests = [];
let server;

function resetSite(robots) {
  site.robots = robots;
  site.status = 200;
  site.overrides = new Map();
  requests.length = 0;
}

before(async () => {
  for (const p of samplePrograms()) for (const s of p.sources) site.pages.set(new URL(s.url).pathname, s.id);
  server = http.createServer((req, res) => {
    requests.push({ path: req.url, ua: req.headers['user-agent'], method: req.method, at: clock.t });
    if (req.url === '/robots.txt') {
      if (site.status !== 200) { res.writeHead(site.status); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(site.robots);
      return;
    }
    const override = site.overrides.get(req.url);
    if (override) { res.writeHead(override.status, { 'content-type': 'text/html' }); res.end(override.body); return; }
    const id = site.pages.get(req.url);
    if (!id) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(sampleHtml(id));
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(PORT, '127.0.0.1', resolve));
});

after(() => new Promise((resolve) => server.close(resolve)));

// A fake clock: sleeping moves it forward, so the gap between two requests is exactly what was asked for.
const clock = { t: Date.parse('2026-09-14T10:15:00.000Z') };
const sleeps = [];
const options = (extra = {}) => ({
  programs: samplePrograms(),
  fetch: (url, init) => fetch(url, init),
  sleep: async (ms) => { sleeps.push(ms); clock.t += ms; },
  now: () => new Date(clock.t),
  originMap: { 'https://sample.invalid': ORIGIN },
  ...extra,
});

function gaps() {
  const out = [];
  for (let i = 1; i < requests.length; i++) out.push(requests[i].at - requests[i - 1].at);
  return out;
}

test('robotsAllows and robotsCrawlDelay', () => {
  const txt = 'User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/open$\nDisallow: /*.pdf$\nCrawl-delay: 10\n';
  assert.equal(robotsAllows(txt, USER_AGENT, '/funding/'), true);
  assert.equal(robotsAllows(txt, USER_AGENT, '/private/x'), false);
  assert.equal(robotsAllows(txt, USER_AGENT, '/private/open'), true);
  assert.equal(robotsAllows(txt, USER_AGENT, '/private/open/more'), false);
  assert.equal(robotsAllows(txt, USER_AGENT, '/guide.pdf'), false);
  assert.equal(robotsAllows(txt, USER_AGENT, '/guide.pdf?x=1'), true);
  assert.equal(robotsCrawlDelay(txt, USER_AGENT), 10);
  const ours = 'User-agent: *\nDisallow: /\n\nUser-agent: APCO-Software-Tools-research\nDisallow: /nope/\n';
  assert.equal(robotsAllows(ours, USER_AGENT, '/funding/'), true, 'our own group replaces *');
  assert.equal(robotsAllows(ours, USER_AGENT, '/nope/x'), false);
  assert.equal(robotsAllows('', USER_AGENT, '/anything'), true);
  assert.equal(robotsCrawlDelay('User-agent: *\nDisallow:\n', USER_AGENT), null);
});

test('every request carries our User-Agent; robots.txt disallow is respected; ≥ 1 s between requests', async () => {
  resetSite('User-agent: *\nDisallow: /grants/digital-adoption/\n');
  const result = await runChecks(options());

  assert.ok(requests.length > 1);
  for (const r of requests) {
    assert.equal(r.ua, USER_AGENT, r.path);
    assert.equal(r.method, 'GET');
  }
  assert.equal(requests.filter((r) => r.path === '/robots.txt').length, 1, 'robots.txt read once per run');
  assert.ok(!requests.some((r) => r.path.startsWith('/grants/digital-adoption/')), 'the disallowed URL is never requested');
  const blocked = result.sources.find((s) => s.source_id === 'ca-sample-digital-adoption-grant--main');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'robots.txt disallows');
  assert.equal(blocked.http_status, null);

  for (const g of gaps()) assert.ok(g >= 1000, `requested gap ${g} ms`);
  assert.equal(result.trigger, 'node');
  assert.equal(result.sources.length, 9);
});

test('Crawl-delay is obeyed when it is longer than 1 s', async () => {
  resetSite('User-agent: *\nCrawl-delay: 3\n');
  await runChecks(options({ only: ['nl-sample-growth-grant', 'nl-sample-equipment-loan'] }));
  assert.equal(requests.length, 4); // robots + 3 pages
  for (const g of gaps()) assert.ok(g >= 3000, `requested gap ${g} ms`);
});

test('a page with one quote removed → missing names it and changed is true', async () => {
  resetSite('User-agent: *\nDisallow:\n');
  const growthHtml = sampleHtml('nl-sample-growth-grant--main');
  assert.ok(growthHtml.includes(REMOVED_QUOTE));
  site.overrides.set('/funding/growth-grant/', { status: 200, body: growthHtml.replace(REMOVED_QUOTE, 'Projects of any size') });
  const raws = [];
  const result = await runChecks(options({ only: ['nl-sample-growth-grant'], trigger: 'manual', onRaw: async (r) => { raws.push(r); } }));

  const main = result.sources.find((s) => s.source_id === 'nl-sample-growth-grant--main');
  assert.equal(main.ok, true);
  assert.equal(main.http_status, 200);
  assert.equal(main.changed, true);
  assert.equal(main.quotes_total, 11); // summary, funding type, intake, amount, cost share, 6 criteria
  assert.equal(main.quotes_found, 10);
  assert.deepEqual(main.missing, [{ path: 'criteria[4].quote', quote: REMOVED_QUOTE }]);
  assert.match(main.sha256, /^[0-9a-f]{64}$/);

  const contact = result.sources.find((s) => s.source_id === 'nl-sample-growth-grant--contact');
  assert.equal(contact.changed, false);
  assert.deepEqual(contact.missing, []);
  assert.equal(contact.quotes_found, 1);

  assert.equal(result.trigger, 'manual');
  assert.deepEqual(raws.map((r) => r.source_id), ['nl-sample-growth-grant--main', 'nl-sample-growth-grant--contact']);
  assert.ok(raws[0].body instanceof Uint8Array && raws[0].body.length > 100);
  assert.equal(raws[0].url, 'https://sample.invalid/funding/growth-grant/', 'onRaw gets the real URL, not the mapped one');

  // Folded into sourceStatus, the missing quote puts the program under review.
  const status = sourceStatusFrom([result]);
  assert.equal(status['nl-sample-growth-grant--main'].missing_quotes, 1);
  assert.equal(status['nl-sample-growth-grant--main'].last_verified_at, null);
  assert.equal(status['nl-sample-growth-grant--contact'].last_verified_at, contact.fetched_at);
  const program = samplePrograms().find((p) => p.slug === 'nl-sample-growth-grant');
  const r = evaluateProgram(program, profileFrom(AUTO_QUERY), { now: NOW, sourceStatus: status });
  assert.equal(r.verification.needs_review, true);
  assert.notEqual(r.fit.label, 'Looks like a fit');
});

test('a page that answers 404 counts every quote as missing; robots.txt that errors stops the host', async () => {
  resetSite('User-agent: *\nDisallow:\n');
  site.overrides.set('/start/startup-support/', { status: 404, body: 'gone' });
  const result = await runChecks(options({ only: ['nl-sample-startup-support'] }));
  const s = result.sources[0];
  assert.equal(s.ok, false);
  assert.equal(s.http_status, 404);
  assert.equal(s.missing.length, s.quotes_total);

  resetSite('');
  site.status = 503;
  const down = await runChecks(options({ only: ['nl-sample-startup-support'] }));
  assert.deepEqual(requests.map((r) => r.path), ['/robots.txt']);
  assert.equal(down.sources[0].ok, false);
  assert.match(down.sources[0].error, /robots\.txt answered HTTP 503/);
});

test('sourceStatusFrom folds runs oldest first', () => {
  const run = (fetched_at, ok, missing) => ({ started_at: fetched_at, finished_at: fetched_at, trigger: 'cron', sources: [{ source_id: 'a--main', ok, fetched_at, missing }] });
  const status = sourceStatusFrom([
    run('2026-09-07T10:15:00.000Z', true, []),
    run('2026-09-14T10:15:00.000Z', true, [{ path: 'summary.quote', quote: 'x' }]),
    run('2026-09-21T10:15:00.000Z', false, []),
  ]);
  assert.deepEqual(status['a--main'], {
    last_checked_at: '2026-09-21T10:15:00.000Z', last_ok: false, last_verified_at: '2026-09-07T10:15:00.000Z', missing_quotes: 0,
  });
});
