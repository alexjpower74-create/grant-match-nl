// Data bundles — docs/API.md §8. buildBundle(...) → { bundle, problems }. No wall-clock values: same inputs, same bytes.

import { verifyProgram } from './verify.js';
import { contextFor } from './text.js';

function entryText(entry) {
  if (typeof entry === 'string') return entry;
  return entry && typeof entry.text === 'string' ? entry.text : null;
}

/** The text context is taken from: blockText when the caller gave it (block edges stop context), else page text. */
function entryBlock(entry) {
  return entry && typeof entry === 'object' && typeof entry.block === 'string' ? entry.block : entryText(entry);
}

const NO_CONTEXT = Object.freeze({ before: '', after: '' });

/** Add source_url and context beside every { quote, source } in a copy of the record. */
function expandQuotes(record, texts) {
  const urls = Object.fromEntries(record.sources.map((s) => [s.id, s.url]));
  const expand = (obj) => {
    if (!obj || typeof obj.quote !== 'string') return obj;
    const text = texts[obj.source];
    return { ...obj, source_url: urls[obj.source] ?? null, context: text ? contextFor(text, obj.quote) : null };
  };
  // Contact quotes get no context (API §1): a phone list's neighbours are other offices' numbers.
  const expandContact = (obj) => ({ ...expand(obj), context: { ...NO_CONTEXT } });
  return {
    ...record,
    summary: expand(record.summary),
    funding_types: record.funding_types.map(expand),
    intake: {
      ...expand(record.intake),
      deadline: record.intake.deadline ? expand(record.intake.deadline) : null,
    },
    max_amount: expand(record.max_amount),
    cost_share: expand(record.cost_share),
    criteria: record.criteria.map(expand),
    contacts: record.contacts.map(expandContact),
  };
}

/**
 * buildBundle({ programs, pageTexts, communities, industries, data_set }) → { bundle, problems }
 * problems: [{ slug, path, reason }]. bundle is null when there is any problem.
 * communities/industries are the reference JSON objects (with their `source`), carried into the bundle as they are.
 */
export function buildBundle({ programs, pageTexts, communities, industries, data_set }) {
  const problems = [];
  const sorted = [...programs].sort((a, b) => String(a.slug).localeCompare(String(b.slug), 'en'));
  const dataSet = data_set ?? (sorted.length > 0 && sorted.every((p) => p.sample === true) ? 'sample' : 'real');

  const seen = new Set();
  for (const p of sorted) {
    const slug = typeof p?.slug === 'string' ? p.slug : '(no slug)';
    if (seen.has(slug)) problems.push({ slug, path: 'slug', reason: 'two programs have this slug' });
    seen.add(slug);
    for (const problem of verifyProgram(p, pageTexts)) {
      const cut = problem.indexOf(': ');
      problems.push({ slug, path: problem.slice(0, cut), reason: problem.slice(cut + 2) });
    }
    if (dataSet === 'real' && p?.sample === true) problems.push({ slug, path: 'sample', reason: 'a SAMPLE program can’t go in the real bundle' });
    if (dataSet === 'sample' && p?.sample !== true) problems.push({ slug, path: 'sample', reason: 'a real program can’t go in the SAMPLE bundle' });
  }
  if (problems.length) return { bundle: null, problems };

  const texts = Object.fromEntries(Object.entries(pageTexts).map(([id, e]) => [id, entryBlock(e)]));
  let builtFrom = null;
  for (const p of sorted) for (const s of p.sources) if (builtFrom === null || s.fetched_at > builtFrom) builtFrom = s.fetched_at;

  return {
    bundle: {
      data_set: dataSet,
      built_from: builtFrom,
      programs: sorted.map((p) => expandQuotes(p, texts)),
      communities,
      industries,
    },
    problems,
  };
}
