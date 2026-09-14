import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCriterion, evaluateProgram, matchPrograms, compareInterval } from '../match.js';
import { buildBundle } from '../bundle.js';
import {
  profileFrom, AUTO_QUERY, DAYCARE_QUERY, NOW, STALE_NOW, SAMPLE_FETCHED_AT, addDays, clone,
  sampleBundlePrograms, samplePrograms, samplePageTexts, reference,
} from './helpers.mjs';

const AUTO = () => profileFrom(AUTO_QUERY);
const DAYCARE = () => profileFrom(DAYCARE_QUERY);
const crit = (rule) => ({ id: 'x', text: 'x', rule, quote: 'x'.repeat(12), source: 's' });
const ev = (rule, profile) => evaluateCriterion(crit(rule), profile);
const status = (rule, profile) => {
  const r = ev(rule, profile);
  return r.unknown_reason ? `unknown:${r.unknown_reason}` : r.status;
};

test('location: province, census divisions, communities', () => {
  assert.equal(status({ kind: 'location', province: 'NL' }, AUTO()), 'met');
  assert.equal(status({ kind: 'location', census_divisions: [6, 7, 8] }, AUTO()), 'met');
  assert.equal(status({ kind: 'location', census_divisions: [1] }, AUTO()), 'missed');
  assert.equal(status({ kind: 'location', communities: ['gander'] }, DAYCARE()), 'met');
  assert.equal(status({ kind: 'location', communities: ['gander'] }, AUTO()), 'missed');
});

test('industry: in and not_in', () => {
  assert.equal(status({ kind: 'industry', in: ['81'] }, AUTO()), 'met');
  assert.equal(status({ kind: 'industry', in: ['44-45'] }, AUTO()), 'missed');
  assert.equal(status({ kind: 'industry', not_in: ['44-45', '72'] }, AUTO()), 'met');
  const retail = profileFrom(AUTO_QUERY, { industry: '44-45' });
  const r = ev({ kind: 'industry', not_in: ['44-45', '72'] }, retail);
  assert.equal(r.status, 'missed');
  assert.equal(r.why, 'You picked Retail trade. The page leaves out Retail trade.');
});

test('structure: in, not_in, and "Not sure" is not answered', () => {
  assert.equal(status({ kind: 'structure', in: ['corporation'] }, AUTO()), 'met');
  assert.equal(status({ kind: 'structure', in: ['corporation'] }, DAYCARE()), 'missed');
  assert.equal(status({ kind: 'structure', not_in: ['nonprofit'] }, DAYCARE()), 'met');
  assert.equal(status({ kind: 'structure', not_in: ['sole_proprietor'] }, DAYCARE()), 'missed');
  assert.equal(status({ kind: 'structure', in: ['corporation'] }, profileFrom(AUTO_QUERY, { structure: 'unsure' })), 'unknown:not_answered');
});

test('unclear on structure and industry: unknown with reason unclear, never met or missed', () => {
  const structure = { kind: 'structure', in: ['corporation', 'sole_proprietor'], unclear: ['cooperative', 'nonprofit'] };
  assert.equal(status(structure, AUTO()), 'met');
  assert.equal(status(structure, DAYCARE()), 'met');
  assert.equal(status(structure, profileFrom(AUTO_QUERY, { structure: 'partnership' })), 'missed');
  const coop = ev(structure, profileFrom(AUTO_QUERY, { structure: 'cooperative' }));
  assert.deepEqual(coop, { status: 'unknown', unknown_reason: 'unclear', why: 'The page\'s wording doesn\'t settle this for Co-operative.' });
  assert.equal(ev(structure, profileFrom(AUTO_QUERY, { structure: 'nonprofit' })).why, 'The page\'s wording doesn\'t settle this for Non-profit or charity.');
  assert.equal(status({ kind: 'structure', not_in: ['partnership'], unclear: ['not_registered'] }, profileFrom(AUTO_QUERY, { structure: 'not_registered' })), 'unknown:unclear');
  assert.equal(status(structure, profileFrom(AUTO_QUERY, { structure: 'unsure' })), 'unknown:not_answered');

  const industry = { kind: 'industry', not_in: ['72'], unclear: ['44-45'] };
  assert.equal(status(industry, AUTO()), 'met');
  assert.equal(status(industry, profileFrom(AUTO_QUERY, { industry: '72' })), 'missed');
  assert.equal(ev(industry, profileFrom(AUTO_QUERY, { industry: '44-45' })).why, 'The page\'s wording doesn\'t settle this for Retail trade.');
  assert.equal(status({ kind: 'industry', in: ['54'], unclear: ['51'] }, profileFrom(AUTO_QUERY, { industry: '51' })), 'unknown:unclear');
});

test('an unclear answer is never Looks like a fit', async () => {
  const growth = clone((await sampleBundlePrograms()).find((p) => p.slug === 'nl-sample-growth-grant'));
  growth.criteria[1].rule = { kind: 'structure', in: ['sole_proprietor', 'partnership'], unclear: ['corporation'] };
  const r = evaluateProgram(growth, AUTO(), { now: NOW });
  assert.equal(r.criteria[1].unknown_reason, 'unclear');
  assert.equal(r.fit.label, 'Might fit');
  assert.ok(r.fit.why.includes('Unknown: the page\'s wording doesn\'t settle it for your answer. Sole proprietors, partnerships or corporations.'));
  assert.deepEqual(r.counts, { met: 4, missed: 0, unknown: 2, self_check: 1 });
});

test('employees: an exact number against the page’s bounds', () => {
  assert.equal(status({ kind: 'employees', lte: 50 }, AUTO()), 'met');
  assert.equal(status({ kind: 'employees', lte: 6 }, AUTO()), 'met');
  assert.equal(status({ kind: 'employees', lt: 6 }, AUTO()), 'missed');
  assert.equal(status({ kind: 'employees', gte: 10 }, AUTO()), 'missed');
  assert.equal(status({ kind: 'employees', gt: 5, lt: 100 }, AUTO()), 'met');
  assert.equal(ev({ kind: 'employees', lte: 50 }, AUTO()).why, 'You said 6 people. The page says up to 50.');
});

test('years_operating: months and years, including a band that straddles', () => {
  const rule = { kind: 'years_operating', lte: 24, unit: 'months' };
  assert.equal(status(rule, DAYCARE()), 'met'); // 1to2 = [12, 24)
  assert.equal(status(rule, AUTO()), 'missed'); // 10plus
  assert.equal(status(rule, profileFrom(AUTO_QUERY, { years: '2to3' })), 'unknown:band_straddles'); // [24, 36)
  assert.equal(status({ kind: 'years_operating', lte: 2, unit: 'years' }, DAYCARE()), 'met');
  assert.equal(status({ kind: 'years_operating', gte: 1, unit: 'years' }, profileFrom(AUTO_QUERY, { years: 'lt1' })), 'missed');
  assert.equal(status({ kind: 'years_operating', gte: 1, unit: 'years' }, profileFrom(AUTO_QUERY, { years: 'not_started' })), 'missed');
});

test('revenue: met, missed, band_straddles and not_answered', () => {
  assert.equal(status({ kind: 'revenue', lt: 10000000 }, AUTO()), 'met'); // 500k_1m
  assert.equal(status({ kind: 'revenue', lte: 5000000 }, profileFrom(AUTO_QUERY, { revenue: '2m_10m' })), 'unknown:band_straddles');
  assert.equal(status({ kind: 'revenue', lt: 30000 }, profileFrom(AUTO_QUERY, { revenue: 'lt30k' })), 'met');
  assert.equal(status({ kind: 'revenue', gte: 30000 }, profileFrom(AUTO_QUERY, { revenue: 'lt30k' })), 'missed');
  assert.equal(status({ kind: 'revenue', gte: 30000 }, profileFrom(AUTO_QUERY, { revenue: '30k_100k' })), 'met');
  assert.equal(status({ kind: 'revenue', gt: 30000 }, profileFrom(AUTO_QUERY, { revenue: '30k_100k' })), 'unknown:band_straddles');
  assert.equal(status({ kind: 'revenue', lt: 10000000 }, profileFrom(AUTO_QUERY, { revenue: '10m_100m' })), 'missed');
  assert.equal(status({ kind: 'revenue', gte: 300000, lte: 100000000 }, profileFrom(AUTO_QUERY, { revenue: '100m_plus' })), 'unknown:band_straddles');
  assert.equal(status({ kind: 'revenue', lt: 10000000 }, profileFrom(AUTO_QUERY, { revenue: 'unsaid' })), 'unknown:not_answered');
  assert.equal(ev({ kind: 'revenue', lte: 5000000 }, profileFrom(AUTO_QUERY, { revenue: '2m_10m' })).why,
    'Your revenue band ($2 million to $10 million) is on both sides of the page\'s limit. The page says up to $5,000,000.');
});

test('project_cost: met, missed, absent and unsure', () => {
  assert.equal(status({ kind: 'project_cost', gte: 10000 }, AUTO()), 'met');
  assert.equal(status({ kind: 'project_cost', gte: 10000 }, profileFrom(AUTO_QUERY, { cost: 'lt10k' })), 'missed');
  assert.equal(status({ kind: 'project_cost', gte: 10000 }, profileFrom(AUTO_QUERY, { cost: null })), 'unknown:not_answered');
  assert.equal(status({ kind: 'project_cost', gte: 10000 }, profileFrom(AUTO_QUERY, { cost: 'unsure' })), 'unknown:not_answered');
});

test('ownership: owners absent vs none vs a list', () => {
  const rule = { kind: 'ownership', any: ['women'] };
  assert.equal(status(rule, profileFrom(AUTO_QUERY, { owners: null })), 'unknown:not_answered');
  assert.equal(status(rule, profileFrom(AUTO_QUERY, { owners: 'none' })), 'missed');
  assert.equal(status(rule, profileFrom(AUTO_QUERY, { owners: 'youth' })), 'missed');
  assert.equal(status(rule, profileFrom(AUTO_QUERY, { owners: 'youth,women' })), 'met');
});

test('purpose and self_check', () => {
  assert.equal(status({ kind: 'purpose', any: ['digital'] }, AUTO()), 'met');
  assert.equal(status({ kind: 'purpose', any: ['hire'] }, AUTO()), 'missed');
  assert.equal(status({ kind: 'self_check' }, AUTO()), 'unknown:self_check');
});

test('interval edges', () => {
  const iv = (min, max, a = true, b = false) => ({ min, max, min_inclusive: a, max_inclusive: b });
  assert.equal(compareInterval(iv(0, 0, true, true), { lte: 0 }), 'met');
  assert.equal(compareInterval(iv(0, 0, true, true), { gt: 0 }), 'missed');
  assert.equal(compareInterval(iv(120, null), { gte: 60 }), 'met');
  assert.equal(compareInterval(iv(120, null), { lte: 200 }), 'unknown' === 'x' ? '' : 'straddles');
  assert.equal(compareInterval(iv(100, 200), { lt: 100 }), 'missed');
  assert.equal(compareInterval(iv(100, 200), { lte: 100 }), 'straddles');
  assert.equal(compareInterval(iv(100, 200), { gte: 200 }), 'missed'); // 200 itself is not in [100, 200)
});

const EXPECTED = {
  'SAMPLE Auto Service': {
    'nl-sample-growth-grant': 'Looks like a fit',
    'nl-sample-wage-subsidy': 'Doesn\'t fit',
    'nl-sample-equipment-loan': 'Looks like a fit',
    'ca-sample-small-lender-loan': 'Looks like a fit',
    'nl-sample-community-fund': 'Might fit',
    'ca-sample-digital-adoption-grant': 'Doesn\'t fit',
    'nl-sample-women-entrepreneur-loan': 'Doesn\'t fit',
    'nl-sample-startup-support': 'Doesn\'t fit',
  },
  'SAMPLE Daycare': {
    'nl-sample-growth-grant': 'Doesn\'t fit',
    'nl-sample-wage-subsidy': 'Looks like a fit',
    'nl-sample-equipment-loan': 'Doesn\'t fit',
    'ca-sample-small-lender-loan': 'Looks like a fit',
    'nl-sample-community-fund': 'Might fit',
    'ca-sample-digital-adoption-grant': 'Doesn\'t fit',
    'nl-sample-women-entrepreneur-loan': 'Looks like a fit',
    'nl-sample-startup-support': 'Looks like a fit',
  },
};

test('fit labels for every SAMPLE program and both test profiles', async () => {
  const programs = await sampleBundlePrograms();
  assert.equal(programs.length, 8);
  for (const [name, query] of [['SAMPLE Auto Service', AUTO_QUERY], ['SAMPLE Daycare', DAYCARE_QUERY]]) {
    const profile = profileFrom(query);
    for (const p of programs) {
      const r = evaluateProgram(p, profile, { now: NOW });
      assert.equal(r.fit.label, EXPECTED[name][p.slug], `${name} × ${p.slug}: ${r.fit.why.join(' | ')}`);
      assert.ok(r.fit.why.length > 0);
    }
  }
});

test('a straddling revenue band makes the lender loan Might fit, never Looks like a fit', async () => {
  const program = (await sampleBundlePrograms()).find((p) => p.slug === 'ca-sample-small-lender-loan');
  const r = evaluateProgram(program, profileFrom(AUTO_QUERY, { revenue: '2m_10m' }), { now: NOW });
  const revenue = r.criteria.find((c) => c.id === 'revenue');
  assert.equal(revenue.status, 'unknown');
  assert.equal(revenue.unknown_reason, 'band_straddles');
  assert.equal(r.fit.label, 'Might fit');
});

test('an all-unknown program is never Looks like a fit', async () => {
  const community = (await sampleBundlePrograms()).find((p) => p.slug === 'nl-sample-community-fund');
  const open = clone(community);
  open.intake = { status: 'continuous', quote: community.summary.quote, source: community.summary.source, deadline: null };
  const onlySelfChecks = clone(open);
  onlySelfChecks.criteria = onlySelfChecks.criteria.filter((c) => c.rule.kind === 'self_check');
  const notAnswered = clone(open);
  notAnswered.criteria.push({ ...community.criteria[1], id: 'owned', rule: { kind: 'ownership', any: ['women'] } });
  notAnswered.criteria = notAnswered.criteria.filter((c) => c.rule.kind !== 'location');
  const everyone = [AUTO(), DAYCARE(), profileFrom(DAYCARE_QUERY, { owners: null })];
  // The ownership rule is only all-unknown for profiles that didn't answer who owns the business.
  const didNotAnswer = [profileFrom(AUTO_QUERY, { owners: null }), profileFrom(DAYCARE_QUERY, { owners: null })];
  for (const [label, program, profiles] of [['location + self_check', open, everyone], ['only self_check', onlySelfChecks, everyone], ['not answered', notAnswered, didNotAnswer]]) {
    for (const profile of profiles) {
      const r = evaluateProgram(program, profile, { now: NOW });
      assert.notEqual(r.fit.label, 'Looks like a fit', `${label}: ${r.fit.why.join(' | ')}`);
    }
  }
  const r = evaluateProgram(onlySelfChecks, AUTO(), { now: NOW });
  assert.deepEqual(r.counts, { met: 0, missed: 0, unknown: 1, self_check: 1 });
  assert.equal(r.criteria[0].unknown_reason, 'self_check');
});

test('closed and deadline-passed programs go to closed as Doesn\'t fit', async () => {
  const programs = await sampleBundlePrograms();
  const { open, closed, counts } = matchPrograms(programs, DAYCARE(), { now: NOW });
  assert.deepEqual(closed.map((r) => r.slug), ['ca-sample-digital-adoption-grant']);
  assert.equal(closed[0].fit.label, 'Doesn\'t fit');
  assert.ok(closed[0].fit.why[0].startsWith('Not taking applications right now.'));
  assert.equal(closed[0].intake.label, 'Closed');
  assert.equal(counts.closed, 1);
  assert.ok(open.some((r) => r.slug === 'nl-sample-wage-subsidy'));

  // The deadline is October 15 in Newfoundland: still open late that evening, closed the next day.
  const lateOnDeadline = matchPrograms(programs, DAYCARE(), { now: '2026-10-16T01:00:00Z' }); // 22:30 NDT Oct 15
  assert.ok(lateOnDeadline.open.some((r) => r.slug === 'nl-sample-wage-subsidy'));
  const after = matchPrograms(programs, DAYCARE(), { now: '2026-10-16T12:00:00Z' });
  const wage = after.closed.find((r) => r.slug === 'nl-sample-wage-subsidy');
  assert.ok(wage, 'deadline passed → closed');
  assert.equal(wage.intake.status, 'closed');
  assert.equal(wage.intake.stated_status, 'open');
  assert.equal(wage.intake.note, 'The deadline on the page has passed.');
  assert.equal(wage.fit.label, 'Doesn\'t fit');
  assert.deepEqual(after.closed.map((r) => r.slug), ['ca-sample-digital-adoption-grant', 'nl-sample-wage-subsidy']);
});

test('now + 61 days → stale and no Looks like a fit; 60 days is not stale', async () => {
  const programs = await sampleBundlePrograms();
  const fresh = matchPrograms(programs, AUTO(), { now: addDays(SAMPLE_FETCHED_AT, 60) });
  assert.ok(fresh.counts.looks > 0);
  assert.ok(fresh.open.every((r) => r.verification.stale === false && r.verification.age_days === 60));

  const stale = matchPrograms(programs, AUTO(), { now: addDays(SAMPLE_FETCHED_AT, 61) });
  assert.equal(stale.counts.looks, 0);
  for (const r of [...stale.open, ...stale.closed]) {
    assert.equal(r.verification.stale, true);
    assert.equal(r.verification.age_days, 61);
  }
  const growth = stale.open.find((r) => r.slug === 'nl-sample-growth-grant');
  assert.equal(growth.fit.label, 'Might fit');
  assert.ok(growth.fit.why.some((w) => w.includes('more than 60 days')));

  const muchLater = matchPrograms(programs, DAYCARE(), { now: STALE_NOW });
  assert.equal(muchLater.counts.looks, 0);

  // A newer successful live check keeps a program fresh.
  const sourceStatus = {};
  for (const p of programs) for (const s of p.sources) sourceStatus[s.id] = { last_checked_at: '2026-11-30T10:15:00.000Z', last_ok: true, last_verified_at: '2026-11-30T10:15:00.000Z', missing_quotes: 0 };
  const rechecked = matchPrograms(programs, AUTO(), { now: STALE_NOW, sourceStatus });
  assert.ok(rechecked.counts.looks > 0);
  assert.equal(rechecked.open[0].verification.last_verified, '2026-11-30');
  assert.equal(rechecked.open[0].verification.last_checked_at, '2026-11-30T10:15:00.000Z');
});

test('sourceStatus with missing quotes → needs_review, not Looks like a fit', async () => {
  const programs = await sampleBundlePrograms();
  const growth = programs.find((p) => p.slug === 'nl-sample-growth-grant');
  const sourceStatus = { 'nl-sample-growth-grant--contact': { last_checked_at: '2026-09-10T10:15:00.000Z', last_ok: true, last_verified_at: null, missing_quotes: 1 } };
  const r = evaluateProgram(growth, AUTO(), { now: NOW, sourceStatus });
  assert.equal(r.verification.needs_review, true);
  assert.equal(r.verification.missing_quotes, 1);
  assert.equal(r.fit.label, 'Might fit');
  assert.ok(r.fit.why.includes('The page has changed or gone since we checked it. Check the official page.'));
  assert.equal(evaluateProgram(growth, AUTO(), { now: NOW }).fit.label, 'Looks like a fit');

  // A page that is gone puts the program under review even with no count.
  const gone = { 'nl-sample-growth-grant--main': { last_checked_at: '2026-09-10T10:15:00.000Z', last_ok: false, last_verified_at: null, missing_quotes: 0, page_gone: true } };
  const g = evaluateProgram(growth, AUTO(), { now: NOW, sourceStatus: gone });
  assert.equal(g.verification.needs_review, true);
  assert.equal(g.verification.missing_quotes, 0);
  assert.equal(g.fit.label, 'Might fit');
});

test('sort order: fit, then non-repayable before loan, then fewer missed and unknown, then name', async () => {
  const { open, closed, counts } = matchPrograms(await sampleBundlePrograms(), AUTO(), { now: NOW });
  assert.deepEqual(open.map((r) => r.slug), [
    'nl-sample-growth-grant', // Looks, non-repayable
    'nl-sample-equipment-loan', // Looks, loan, 0 unknown
    'ca-sample-small-lender-loan', // Looks, loan, 1 unknown (self_check)
    'nl-sample-community-fund', // Might
    'nl-sample-wage-subsidy', // Doesn't, wage subsidy
    'nl-sample-startup-support', // Doesn't, repayable
    'nl-sample-women-entrepreneur-loan', // Doesn't, loan
  ]);
  assert.deepEqual(closed.map((r) => r.slug), ['ca-sample-digital-adoption-grant']);
  assert.deepEqual(counts, { looks: 3, might: 1, doesnt: 3, closed: 1 });
});

test('ProgramResult shape: quotes carry source_url and context; no profile → nulls and zeros', async () => {
  const programs = await sampleBundlePrograms();
  const growth = programs.find((p) => p.slug === 'nl-sample-growth-grant');
  const r = evaluateProgram(growth, AUTO(), { now: NOW });
  assert.deepEqual(Object.keys(r), ['slug', 'sample', 'name', 'provider', 'level', 'url', 'summary', 'funding_types', 'best_type', 'intake',
    'max_amount', 'cost_share', 'contacts', 'criteria', 'counts', 'fit', 'verification', 'unknown_facts', 'sources']);
  assert.equal(r.best_type, 'non_repayable');
  assert.equal(r.funding_types[0].label, 'Non-repayable');
  assert.equal(r.intake.label, 'Takes applications any time');
  assert.equal(r.criteria[2].source_url, 'https://sample.invalid/funding/growth-grant/');
  assert.deepEqual(Object.keys(r.criteria[2].context), ['before', 'after']);
  assert.ok(!r.criteria[2].context.before.includes('Home Funding'), 'context never starts in the menu');
  assert.deepEqual(r.max_amount.context, { before: '', after: '' }, 'no boundary within 160 characters before; the quote ends its own sentence');
  assert.equal(r.contacts[0].phone, '709-555-0101');
  assert.equal(r.contacts[0].source_url, 'https://sample.invalid/contact/');
  assert.deepEqual(r.counts, { met: 5, missed: 0, unknown: 1, self_check: 1 });
  assert.deepEqual(r.verification, { last_verified: '2026-09-01', age_days: 13, stale: false, needs_review: false, missing_quotes: 0, last_checked_at: null });
  assert.deepEqual(r.unknown_facts, []);

  const bare = evaluateProgram(growth, null, { now: NOW });
  assert.equal(bare.fit, null);
  assert.ok(bare.criteria.every((c) => c.status === null && c.why === null && c.unknown_reason === null));
  assert.deepEqual(bare.counts, { met: 0, missed: 0, unknown: 0, self_check: 0 });

  const community = evaluateProgram(programs.find((p) => p.slug === 'nl-sample-community-fund'), null, { now: NOW });
  assert.deepEqual(community.unknown_facts, ['intake', 'max_amount', 'cost_share']);
  assert.equal(community.intake.quote, null);
  assert.equal(community.intake.label, 'The page doesn\'t say');
});

test('buildBundle is byte-identical across two runs', async () => {
  const { communities, industries } = reference();
  const build = async () => JSON.stringify(buildBundle({ programs: samplePrograms(), pageTexts: await samplePageTexts(), communities, industries }).bundle);
  const [a, b] = [await build(), await build()];
  assert.equal(a, b);
  const bundle = JSON.parse(a);
  assert.equal(bundle.data_set, 'sample');
  assert.equal(bundle.built_from, SAMPLE_FETCHED_AT);
  assert.deepEqual(bundle.programs.map((p) => p.slug), [...bundle.programs.map((p) => p.slug)].sort());
  // Input order doesn't change the bytes either.
  const reversed = JSON.stringify(buildBundle({ programs: samplePrograms().reverse(), pageTexts: await samplePageTexts(), communities, industries }).bundle);
  assert.equal(reversed, a);
});
