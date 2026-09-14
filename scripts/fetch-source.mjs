#!/usr/bin/env node
// Fetch one official page politely and save its raw bytes as evidence.
//
//   node scripts/fetch-source.mjs --id <slug>--<name> --url <https url> [--publisher "…"] [--ext html] [--force]
//
// Obeys robots.txt for our User-Agent, waits ≥ 1 s (or the host's Crawl-delay) since the last request to that host
// (remembered across runs in scripts/.state/fetch-state.json, never committed), saves data/sources/<id>.<ext> byte for byte, and prints
// the sources[] JSON entry with both hashes. Refuses to overwrite an existing file without --force. Exit 1 on any
// problem, and nothing is saved.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT, rel, sleep } from './lib.mjs';
import { USER_AGENT, MIN_DELAY_MS, TIMEOUT_MS, robotsAllows, robotsCrawlDelay } from '../core/checks.js';
import { pageText } from '../core/text.js';
import { sha256Hex } from '../core/hash.js';

const { flags } = parseArgs(process.argv.slice(2), ['force', 'allow-redirect']);
const fail = (msg) => { console.error(`fetch-source: ${msg}`); process.exit(1); };

const id = flags.id;
const url = flags.url;
const ext = flags.ext ?? 'html';
if (typeof id !== 'string' || !/^(?:[a-z0-9-]+--[a-z0-9-]{1,40}|ref-[a-z0-9-]{1,60})$/.test(id)) {
  fail('--id must look like <slug>--<name> (e.g. nl-business-growth-program--main) or ref-<name>');
}
if (typeof url !== 'string') fail('--url is required');
let target;
try { target = new URL(url); } catch { fail(`not a URL: ${url}`); }
if (target.protocol !== 'https:') fail('only https URLs');
if (!/^[a-z0-9]{1,8}$/.test(ext)) fail('--ext must be a short extension like html or zip');

const outDir = path.resolve(ROOT, flags.out ?? 'data/sources');
const outFile = path.join(outDir, `${id}.${ext}`);
if (fs.existsSync(outFile) && !flags.force) fail(`${rel(outFile)} already exists; pass --force to replace it`);

const stateFile = path.resolve(ROOT, process.env.GM_FETCH_STATE ?? 'scripts/.state/fetch-state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const saveState = () => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

async function politeGet(u, delayMs) {
  const origin = new URL(u).origin;
  const last = state[origin]?.last_at ?? 0;
  const wait = Math.max(delayMs, state[origin]?.delay_ms ?? 0) - (Date.now() - last);
  if (wait > 0) {
    console.error(`fetch-source: waiting ${Math.ceil(wait / 100) / 10} s for ${origin}`);
    await sleep(wait);
  }
  state[origin] = { ...(state[origin] ?? {}), last_at: Date.now() };
  saveState();
  try {
    return await fetch(u, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } finally {
    state[origin].last_at = Date.now();
    saveState();
  }
}

// robots.txt
const robotsRes = await politeGet(`${target.origin}/robots.txt`, MIN_DELAY_MS);
const robotsTxt = await robotsRes.text();
let robots;
let delayMs = MIN_DELAY_MS;
if (robotsRes.status >= 200 && robotsRes.status < 300) {
  const pathAndQuery = `${target.pathname}${target.search}`;
  if (!robotsAllows(robotsTxt, USER_AGENT, pathAndQuery)) fail(`robots.txt at ${target.origin} disallows ${pathAndQuery} for our User-Agent`);
  robots = 'allowed';
  const cd = robotsCrawlDelay(robotsTxt, USER_AGENT);
  if (cd !== null) delayMs = Math.max(MIN_DELAY_MS, cd * 1000);
} else if (robotsRes.status >= 400 && robotsRes.status < 500) {
  robots = 'allowed (no robots.txt)';
} else {
  fail(`robots.txt answered HTTP ${robotsRes.status}; not fetching`);
}
state[target.origin].delay_ms = delayMs;
saveState();

// the page
const res = await politeGet(url, delayMs);
const bytes = new Uint8Array(await res.arrayBuffer());
const fetchedAt = new Date().toISOString();
if (res.status !== 200) fail(`${url} answered HTTP ${res.status}; nothing saved`);
if (res.url && res.url !== url) {
  const final = new URL(res.url);
  const msg = `${url} redirected to ${res.url}`;
  if (!flags['allow-redirect']) fail(`${msg}; a page that redirects away is not a source (pass --allow-redirect after checking it, and use the final URL)`);
  const finalPath = `${final.pathname}${final.search}`;
  if (final.origin !== target.origin || !robotsAllows(robotsTxt, USER_AGENT, finalPath)) fail(`${msg}, which robots.txt does not allow or is another host`);
  console.error(`fetch-source: ${msg}`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, bytes);

const isHtml = ext === 'html' || /html/i.test(res.headers.get('content-type') ?? '');
const html = isHtml ? new TextDecoder('utf-8').decode(bytes) : '';
const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
const title = titleMatch ? pageText(`<p>${titleMatch[1]}</p>`) : null;

const entry = {
  id,
  url: res.url || url,
  title,
  publisher: flags.publisher ?? null,
  fetched_at: fetchedAt,
  http_status: res.status,
  sha256: await sha256Hex(bytes),
  text_sha256: isHtml ? await sha256Hex(pageText(html)) : null,
  robots,
  terms_note: null,
  terms_url: null,
};
console.error(`fetch-source: saved ${rel(outFile)} (${bytes.length} bytes, ${res.headers.get('content-type') ?? 'no content-type'})`);
console.log(JSON.stringify(entry, null, 2));
