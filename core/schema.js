// ProgramRecord shape — docs/API.md §3–4. validateProgram(record) → string[] ("<json path>: <reason>").

import { STRUCTURES, OWNERS, PURPOSES, FUNDING_TYPES } from './profile.js';

export const LEVELS = ['provincial', 'federal', 'regional', 'nonprofit', 'crown'];
export const INTAKE_STATUSES = ['open', 'continuous', 'upcoming', 'closed', 'unknown'];
export const RULE_KINDS = [
  'location', 'industry', 'structure', 'employees', 'years_operating', 'revenue', 'project_cost',
  'ownership', 'purpose', 'self_check',
];
export const BOUND_KINDS = ['employees', 'years_operating', 'revenue', 'project_cost'];
export const NAICS_SECTORS = [
  '11', '21', '22', '23', '31-33', '41', '44-45', '48-49', '51', '52', '53', '54', '55', '56', '61', '62', '71',
  '72', '81', '91',
];
export const SLUG_RE = /^(nl|ca)-[a-z0-9-]{3,80}$/;
export const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CRITERION_ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;
export const SAMPLE_ORIGIN = 'https://sample.invalid/';

const TOP_KEYS = [
  'slug', 'sample', 'name', 'provider', 'level', 'url', 'summary', 'sources', 'funding_types', 'intake',
  'max_amount', 'cost_share', 'criteria', 'contacts', 'research',
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isDate = (s) => DATE_RE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const isIsoUtc = (s) => typeof s === 'string' && ISO_UTC_RE.test(s) && new Date(s).toISOString() === s;
const isHttpsUrl = (s) => {
  if (typeof s !== 'string') return false;
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

/** Validate a ProgramRecord. Returns plain-English problems, each prefixed with its JSON path. */
export function validateProgram(record) {
  const problems = [];
  const bad = (path, reason) => problems.push(`${path}: ${reason}`);

  if (!isObj(record)) return ['$: the record must be a JSON object'];

  for (const k of Object.keys(record)) if (!TOP_KEYS.includes(k)) bad(k, 'unknown key');
  for (const k of TOP_KEYS) if (!(k in record)) bad(k, 'required key is missing');

  const { slug, sample } = record;
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) bad('slug', 'must match ^(nl|ca)-[a-z0-9-]{3,80}$');
  if (typeof sample !== 'boolean') bad('sample', 'must be true or false');
  if (!isStr(record.name)) bad('name', 'must be a non-empty string');
  if (!isStr(record.provider)) bad('provider', 'must be a non-empty string');
  if (sample === true) {
    if (isStr(record.name) && !record.name.startsWith('SAMPLE ')) bad('name', 'a SAMPLE program’s name must start "SAMPLE "');
    if (isStr(record.provider) && !record.provider.startsWith('SAMPLE ')) bad('provider', 'a SAMPLE program’s provider must start "SAMPLE "');
  } else if (sample === false) {
    if (isStr(record.name) && /^SAMPLE\b/.test(record.name)) bad('name', 'only SAMPLE programs may be named "SAMPLE"');
  }
  if (!LEVELS.includes(record.level)) bad('level', `must be one of ${LEVELS.join(', ')}`);
  checkUrl('url', record.url);

  // Sources first: every other `source` must name one of these.
  const sourceIds = new Set();
  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    bad('sources', 'must be a non-empty array');
  } else {
    record.sources.forEach((s, i) => {
      const p = `sources[${i}]`;
      if (!isObj(s)) return bad(p, 'must be an object');
      const keys = ['id', 'url', 'title', 'publisher', 'fetched_at', 'http_status', 'sha256', 'text_sha256', 'robots',
        'terms_note', 'terms_url'];
      for (const k of Object.keys(s)) if (!keys.includes(k)) bad(`${p}.${k}`, 'unknown key');
      const idRe = typeof slug === 'string' ? new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}--[a-z0-9-]{1,40}$`) : null;
      if (typeof s.id !== 'string' || !idRe || !idRe.test(s.id)) bad(`${p}.id`, `must match ^<slug>--[a-z0-9-]{1,40}$`);
      else if (sourceIds.has(s.id)) bad(`${p}.id`, `duplicate source id "${s.id}"`);
      else sourceIds.add(s.id);
      checkUrl(`${p}.url`, s.url);
      if (!isStr(s.title)) bad(`${p}.title`, 'must be a non-empty string');
      if (!isStr(s.publisher)) bad(`${p}.publisher`, 'must be a non-empty string');
      if (!isIsoUtc(s.fetched_at)) bad(`${p}.fetched_at`, 'must be a strict UTC ISO time like 2026-09-14T06:12:00.000Z');
      if (!Number.isInteger(s.http_status) || s.http_status < 100 || s.http_status > 599) bad(`${p}.http_status`, 'must be an HTTP status code');
      else if (s.http_status !== 200) bad(`${p}.http_status`, 'a source page must have answered 200');
      if (typeof s.sha256 !== 'string' || !HEX64_RE.test(s.sha256)) bad(`${p}.sha256`, 'must be 64 lowercase hex characters');
      if (typeof s.text_sha256 !== 'string' || !HEX64_RE.test(s.text_sha256)) bad(`${p}.text_sha256`, 'must be 64 lowercase hex characters');
      if (!isStr(s.robots)) bad(`${p}.robots`, 'must say what robots.txt said, e.g. "allowed"');
      else if (/disallow/i.test(s.robots)) bad(`${p}.robots`, 'a page robots.txt disallows can’t be a source');
      if (!(s.terms_note === null || isStr(s.terms_note))) bad(`${p}.terms_note`, 'must be a string or null');
      if (!(s.terms_url === null || isHttpsUrl(s.terms_url))) bad(`${p}.terms_url`, 'must be an https URL or null');
    });
  }

  function checkUrl(path, url) {
    if (!isHttpsUrl(url)) return bad(path, 'must be an https URL');
    if (sample === true && !url.startsWith(SAMPLE_ORIGIN)) bad(path, `a SAMPLE program’s URLs must be on ${SAMPLE_ORIGIN}`);
    if (sample === false && url.startsWith(SAMPLE_ORIGIN)) bad(path, 'a real program can’t use a sample.invalid URL');
  }

  function checkQuoted(path, obj, extraKeys = []) {
    if (!isObj(obj)) return bad(path, 'must be an object');
    for (const k of Object.keys(obj)) if (![...extraKeys, 'quote', 'source'].includes(k)) bad(`${path}.${k}`, 'unknown key');
    checkQuote(`${path}.quote`, obj.quote);
    if (typeof obj.source !== 'string') bad(`${path}.source`, 'must name a source id');
    else if (!sourceIds.has(obj.source)) bad(`${path}.source`, `"${obj.source}" is not in sources`);
  }

  function checkQuote(path, q) {
    if (typeof q !== 'string') return bad(path, 'must be a string');
    if (q.length < 12 || q.length > 700) bad(path, `must be 12–700 characters (is ${q.length})`);
    if (q !== q.trim()) bad(path, 'must not start or end with whitespace');
  }

  checkQuoted('summary', record.summary);

  if (!Array.isArray(record.funding_types)) bad('funding_types', 'must be an array ([] when the page doesn’t say)');
  else {
    const types = ids(FUNDING_TYPES);
    record.funding_types.forEach((f, i) => {
      const p = `funding_types[${i}]`;
      checkQuoted(p, f, ['type', 'applies_to']);
      if (!isObj(f)) return;
      if (!types.includes(f.type)) bad(`${p}.type`, `must be one of ${types.join(', ')}`);
      if (!(f.applies_to === null || isStr(f.applies_to))) bad(`${p}.applies_to`, 'must be a string or null');
    });
  }

  const intake = record.intake;
  if (!isObj(intake)) bad('intake', 'must be an object');
  else {
    for (const k of Object.keys(intake)) if (!['status', 'quote', 'source', 'deadline'].includes(k)) bad(`intake.${k}`, 'unknown key');
    if (!INTAKE_STATUSES.includes(intake.status)) bad('intake.status', `must be one of ${INTAKE_STATUSES.join(', ')}`);
    if (intake.status === 'unknown') {
      if (intake.quote !== null || intake.source !== null) bad('intake', 'an unknown intake has quote and source null');
    } else {
      checkQuote('intake.quote', intake.quote);
      if (typeof intake.source !== 'string') bad('intake.source', 'must name a source id');
      else if (!sourceIds.has(intake.source)) bad('intake.source', `"${intake.source}" is not in sources`);
    }
    if (!('deadline' in intake)) bad('intake.deadline', 'required key is missing (null when there is none)');
    else if (intake.deadline !== null) {
      checkQuoted('intake.deadline', intake.deadline, ['date']);
      if (isObj(intake.deadline) && !(typeof intake.deadline.date === 'string' && isDate(intake.deadline.date))) {
        bad('intake.deadline.date', 'must be a real date YYYY-MM-DD');
      }
      if (intake.status === 'unknown' || intake.status === 'continuous') bad('intake.deadline', `a ${intake.status} intake can’t have a deadline`);
    }
  }

  if (record.max_amount !== null && record.max_amount !== undefined) {
    const m = record.max_amount;
    checkQuoted('max_amount', m, ['amount', 'text']);
    if (isObj(m)) {
      if (typeof m.amount !== 'number' || !Number.isFinite(m.amount) || m.amount <= 0) bad('max_amount.amount', 'must be a number above 0');
      if (!isStr(m.text)) bad('max_amount.text', 'must be a non-empty string');
    }
  }

  if (record.cost_share !== null && record.cost_share !== undefined) {
    const c = record.cost_share;
    checkQuoted('cost_share', c, ['percent', 'text']);
    if (isObj(c)) {
      if (typeof c.percent !== 'number' || !(c.percent > 0 && c.percent <= 100)) bad('cost_share.percent', 'must be a number above 0 and at most 100');
      if (!isStr(c.text)) bad('cost_share.text', 'must be a non-empty string');
    }
  }

  if (!Array.isArray(record.criteria)) bad('criteria', 'must be an array');
  else {
    const seen = new Set();
    record.criteria.forEach((c, i) => {
      const p = `criteria[${i}]`;
      checkQuoted(p, c, ['id', 'text', 'rule']);
      if (!isObj(c)) return;
      if (typeof c.id !== 'string' || !CRITERION_ID_RE.test(c.id)) bad(`${p}.id`, 'must be a short lowercase id (a-z, 0-9, - or _)');
      else if (seen.has(c.id)) bad(`${p}.id`, `duplicate criterion id "${c.id}"`);
      else seen.add(c.id);
      if (!isStr(c.text)) bad(`${p}.text`, 'must be a non-empty string');
      checkRule(`${p}.rule`, c.rule);
    });
  }

  if (!Array.isArray(record.contacts)) bad('contacts', 'must be an array ([] when no official page gives one)');
  else {
    record.contacts.forEach((c, i) => {
      const p = `contacts[${i}]`;
      checkQuoted(p, c, ['label', 'phone', 'email', 'census_divisions']);
      if (!isObj(c)) return;
      if (!isStr(c.label)) bad(`${p}.label`, 'must be a non-empty string');
      if (!(c.phone === null || isStr(c.phone))) bad(`${p}.phone`, 'must be a string or null');
      if (!(c.email === null || (isStr(c.email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))) bad(`${p}.email`, 'must be an email address or null');
      if (c.phone == null && c.email == null) bad(p, 'a contact needs a phone or an email');
      if (c.phone != null && isStr(c.phone) && c.phone.replace(/\D/g, '').length < 7) bad(`${p}.phone`, 'must have at least 7 digits');
      if (!(c.census_divisions === null || (Array.isArray(c.census_divisions) && c.census_divisions.every(isDivision)))) {
        bad(`${p}.census_divisions`, 'must be null or a list of census division numbers 1–11');
      }
    });
  }

  if (!isObj(record.research)) bad('research', 'must be an object { by, notes }');
  else {
    for (const k of Object.keys(record.research)) if (!['by', 'notes'].includes(k)) bad(`research.${k}`, 'unknown key');
    if (!isStr(record.research.by)) bad('research.by', 'must be a non-empty string');
    if (typeof record.research.notes !== 'string') bad('research.notes', 'must be a string');
  }

  function checkRule(path, rule) {
    if (!isObj(rule)) return bad(path, 'must be an object');
    const { kind, ...rest } = rule;
    if (!RULE_KINDS.includes(kind)) return bad(`${path}.kind`, `must be one of ${RULE_KINDS.join(', ')}`);
    const keys = Object.keys(rest);
    const only = (allowed) => keys.forEach((k) => { if (!allowed.includes(k)) bad(`${path}.${k}`, `unknown key for a ${kind} rule`); });
    const nonEmptyFrom = (k, list) => {
      const v = rest[k];
      if (!Array.isArray(v) || v.length === 0) return bad(`${path}.${k}`, 'must be a non-empty array');
      v.forEach((x, j) => { if (!list.includes(x)) bad(`${path}.${k}[${j}]`, `"${x}" is not a known id`); });
      if (new Set(v).size !== v.length) bad(`${path}.${k}`, 'has duplicates');
    };
    const inOrNotIn = (list) => {
      only(['in', 'not_in', 'unclear']);
      if (('in' in rest) === ('not_in' in rest)) return bad(path, 'needs exactly one of in, not_in');
      const key = 'in' in rest ? 'in' : 'not_in';
      nonEmptyFrom(key, list);
      if ('unclear' in rest) {
        nonEmptyFrom('unclear', list);
        if (Array.isArray(rest.unclear) && Array.isArray(rest[key])) {
          for (const id of rest.unclear) if (rest[key].includes(id)) bad(`${path}.unclear`, `"${id}" can’t be in both unclear and ${key}`);
        }
      }
    };

    switch (kind) {
      case 'self_check':
        only([]);
        break;
      case 'location': {
        only(['province', 'census_divisions', 'communities']);
        const present = ['province', 'census_divisions', 'communities'].filter((k) => k in rest);
        if (present.length !== 1) return bad(path, 'needs exactly one of province, census_divisions, communities');
        if (present[0] === 'province' && rest.province !== 'NL') bad(`${path}.province`, 'must be "NL"');
        if (present[0] === 'census_divisions') {
          const v = rest.census_divisions;
          if (!Array.isArray(v) || v.length === 0 || !v.every(isDivision)) bad(`${path}.census_divisions`, 'must be a non-empty list of 1–11');
        }
        if (present[0] === 'communities') {
          const v = rest.communities;
          if (!Array.isArray(v) || v.length === 0 || !v.every(isStr)) bad(`${path}.communities`, 'must be a non-empty list of community ids');
        }
        break;
      }
      case 'industry':
        inOrNotIn(NAICS_SECTORS);
        break;
      case 'structure':
        inOrNotIn(ids(STRUCTURES).filter((id) => id !== 'unsure'));
        break;
      case 'ownership':
        only(['any']);
        nonEmptyFrom('any', ids(OWNERS));
        break;
      case 'purpose':
        only(['any', 'unclear']);
        nonEmptyFrom('any', ids(PURPOSES));
        if ('unclear' in rest) {
          nonEmptyFrom('unclear', ids(PURPOSES));
          if (Array.isArray(rest.unclear) && Array.isArray(rest.any)) {
            for (const id of rest.unclear) if (rest.any.includes(id)) bad(`${path}.unclear`, `"${id}" can’t be in both unclear and any`);
          }
        }
        break;
      default: { // bounds
        only(kind === 'years_operating' ? ['gte', 'gt', 'lte', 'lt', 'unit', 'normally'] : ['gte', 'gt', 'lte', 'lt', 'normally']);
        if (kind === 'years_operating' && !['months', 'years'].includes(rest.unit)) bad(`${path}.unit`, 'must be "months" or "years"');
        if ('normally' in rest && rest.normally !== true) bad(`${path}.normally`, 'must be true when present (leave it out otherwise)');
        const bounds = ['gte', 'gt', 'lte', 'lt'].filter((k) => k in rest);
        if (bounds.length === 0) return bad(path, 'needs at least one of gte, gt, lte, lt');
        if ('gte' in rest && 'gt' in rest) bad(path, 'can’t have both gte and gt');
        if ('lte' in rest && 'lt' in rest) bad(path, 'can’t have both lte and lt');
        for (const b of bounds) {
          if (typeof rest[b] !== 'number' || !Number.isFinite(rest[b]) || rest[b] < 0) bad(`${path}.${b}`, 'must be a number, 0 or more');
        }
        const lo = rest.gte ?? rest.gt;
        const hi = rest.lte ?? rest.lt;
        if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) bad(path, 'the lower bound is above the upper bound');
      }
    }
  }

  return problems;
}

function isDivision(n) {
  return Number.isInteger(n) && n >= 1 && n <= 11;
}

function ids(list) {
  return list.map((o) => o.id);
}
