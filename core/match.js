// Rules matching — docs/API.md §5–6. Pure ESM, no dependencies. No model decides anything here.

import { STRUCTURES, YEARS, REVENUE, COST, OWNERS, PURPOSES, FUNDING_TYPES } from './profile.js';

export const FIT = {
  looks: { label: 'Looks like a fit', rank: 0 },
  might: { label: 'Might fit', rank: 1 },
  doesnt: { label: 'Doesn\'t fit', rank: 2 },
};

export const INTAKE_LABELS = {
  open: 'Taking applications',
  continuous: 'Takes applications any time',
  upcoming: 'Not open yet',
  closed: 'Closed',
  unknown: 'The page doesn\'t say',
};

export const TYPE_RANK = { non_repayable: 0, wage_subsidy: 1, tax_credit: 2, repayable: 3, loan: 4 };
export const STALE_DAYS = 60;
const DAY_MS = 86400000;
const TIME_ZONE = 'America/St_Johns';

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? id;

function joinWords(words, last = 'and') {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1]}`;
}

function commas(n) {
  const [int, frac] = String(n).split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withCommas}.${frac}` : withCommas;
}

// ---- intervals -----------------------------------------------------------------------------------------------

/** The satisfying interval of a bounds rule, in the rule's own unit converted to the profile's unit. */
function boundsInterval(rule, scale = 1) {
  const s = { min: null, max: null, min_inclusive: false, max_inclusive: false }; // null = unbounded
  if (typeof rule.gte === 'number') Object.assign(s, { min: rule.gte * scale, min_inclusive: true });
  if (typeof rule.gt === 'number') Object.assign(s, { min: rule.gt * scale, min_inclusive: false });
  if (typeof rule.lte === 'number') Object.assign(s, { max: rule.lte * scale, max_inclusive: true });
  if (typeof rule.lt === 'number') Object.assign(s, { max: rule.lt * scale, max_inclusive: false });
  return s;
}

/** Is profile interval `a` entirely inside rule interval `s`? (a.min is never unbounded.) */
function inside(a, s) {
  const lowOk = s.min === null || a.min > s.min || (a.min === s.min && (s.min_inclusive || !a.min_inclusive));
  if (!lowOk) return false;
  if (s.max === null) return true;
  if (a.max === null) return false;
  return a.max < s.max || (a.max === s.max && (s.max_inclusive || !a.max_inclusive));
}

/** Do the two intervals share at least one value? */
function overlaps(a, s) {
  // Lower end of the intersection.
  let lo = a.min; let loIn = a.min_inclusive;
  if (s.min !== null && (s.min > lo || (s.min === lo && !s.min_inclusive))) { lo = s.min; loIn = s.min_inclusive; }
  // Upper end of the intersection (null = unbounded).
  let hi = a.max; let hiIn = a.max_inclusive;
  if (s.max !== null && (hi === null || s.max < hi || (s.max === hi && !s.max_inclusive))) { hi = s.max; hiIn = s.max_inclusive; }
  if (hi === null) return true;
  if (lo < hi) return true;
  return lo === hi && loIn && hiIn;
}

/** 'met' | 'missed' | 'straddles' for a profile interval against a bounds rule. */
export function compareInterval(profileInterval, rule, scale = 1) {
  const s = boundsInterval(rule, scale);
  if (inside(profileInterval, s)) return 'met';
  if (!overlaps(profileInterval, s)) return 'missed';
  return 'straddles';
}

function boundsWords(rule, fmt) {
  const parts = [];
  if (typeof rule.gte === 'number') parts.push(`at least ${fmt(rule.gte)}`);
  if (typeof rule.gt === 'number') parts.push(`more than ${fmt(rule.gt)}`);
  if (typeof rule.lte === 'number') parts.push(`up to ${fmt(rule.lte)}`);
  if (typeof rule.lt === 'number') parts.push(`under ${fmt(rule.lt)}`);
  return parts.join(' and ');
}

// ---- one criterion -------------------------------------------------------------------------------------------

const result = (status, why, unknown_reason = null) => ({ status, unknown_reason, why });
const unclearResult = (label) => result('unknown', `The page's wording doesn't settle this for ${label}.`, 'unclear');

/** evaluateCriterion(criterion, profile) → { status, unknown_reason, why } */
export function evaluateCriterion(criterion, profile) {
  const rule = criterion.rule ?? {};
  switch (rule.kind) {
    case 'self_check':
      return result('unknown', 'Check this yourself. Your answers can\'t settle it.', 'self_check');

    case 'location': {
      const c = profile.community;
      if ('province' in rule) return result('met', `You said ${c.name}. The page says Newfoundland and Labrador.`);
      if ('census_divisions' in rule) {
        const list = rule.census_divisions;
        const listed = `${list.length === 1 ? 'Census Division' : 'Census Divisions'} ${joinWords(list.map(String))}`;
        const where = c.census_division ? `${c.name} is in Census Division ${c.census_division}` : `You said ${c.name}`;
        return list.includes(c.census_division)
          ? result('met', `${where}. The page covers ${listed}.`)
          : result('missed', `${where}. The page covers only ${listed}.`);
      }
      return rule.communities.includes(c.id)
        ? result('met', `You said ${c.name}. The page names it.`)
        : result('missed', `You said ${c.name}. The page doesn't name it.`);
    }

    case 'industry': {
      const name = profile.industry.name;
      if (rule.unclear?.includes(profile.industry.id)) return unclearResult(name);
      if (rule.not_in) {
        return rule.not_in.includes(profile.industry.id)
          ? result('missed', `You picked ${name}. The page leaves out ${name}.`)
          : result('met', `You picked ${name}. The page doesn't leave it out.`);
      }
      return rule.in.includes(profile.industry.id)
        ? result('met', `You picked ${name}. The page includes ${name}.`)
        : result('missed', `You picked ${name}. The page doesn't include it.`);
    }

    case 'structure': {
      if (profile.structure === 'unsure') return result('unknown', 'You weren\'t sure how the business is set up.', 'not_answered');
      const mine = labelOf(STRUCTURES, profile.structure);
      if (rule.unclear?.includes(profile.structure)) return unclearResult(mine);
      if (rule.not_in) {
        return rule.not_in.includes(profile.structure)
          ? result('missed', `You picked ${mine}. The page leaves that out.`)
          : result('met', `You picked ${mine}. The page doesn't leave that out.`);
      }
      const accepted = joinWords(rule.in.map((id) => labelOf(STRUCTURES, id)), 'or');
      return rule.in.includes(profile.structure)
        ? result('met', `You picked ${mine}. The page accepts ${accepted}.`)
        : result('missed', `You picked ${mine}. The page accepts only ${accepted}.`);
    }

    case 'ownership': {
      if (profile.owners === null || profile.owners === undefined) {
        return result('unknown', 'You didn\'t say who owns the business.', 'not_answered');
      }
      const wanted = joinWords(rule.any.map((id) => labelOf(OWNERS, id)), 'or');
      const mine = profile.owners.length ? joinWords(profile.owners.map((id) => labelOf(OWNERS, id))) : 'none of these';
      return profile.owners.some((o) => rule.any.includes(o))
        ? result('met', `You said the owners are: ${mine}. The page is for businesses owned by ${wanted}.`)
        : result('missed', `You said the owners are: ${mine}. The page is for businesses owned by ${wanted}.`);
    }

    case 'purpose': {
      const wanted = joinWords(rule.any.map((id) => labelOf(PURPOSES, id)), 'or');
      const mine = joinWords(profile.purposes.map((id) => labelOf(PURPOSES, id)));
      return profile.purposes.some((p) => rule.any.includes(p))
        ? result('met', `You picked ${mine}. The page covers ${wanted}.`)
        : result('missed', `You picked ${mine}. The page covers only ${wanted}.`);
    }

    case 'employees': {
      const n = profile.employees;
      const iv = { min: n, max: n, min_inclusive: true, max_inclusive: true };
      const said = `You said ${commas(n)} ${n === 1 ? 'person' : 'people'}. The page says ${boundsWords(rule, commas)}.`;
      const cmp = compareInterval(iv, rule);
      return cmp === 'met' ? result('met', said) : result('missed', said);
    }

    case 'years_operating': {
      const band = YEARS.find((y) => y.id === profile.years);
      const unit = rule.unit === 'years' ? 'years' : 'months';
      const scale = unit === 'years' ? 12 : 1;
      return bandResult(band.interval, rule, scale, `Your time in business (${band.label.toLowerCase()})`,
        (v) => `${commas(v)} ${unit === 'years' ? (v === 1 ? 'year' : 'years') : (v === 1 ? 'month' : 'months')}`);
    }

    case 'revenue': {
      if (profile.revenue === 'unsaid') return result('unknown', 'You preferred not to say your revenue.', 'not_answered');
      const band = REVENUE.find((r) => r.id === profile.revenue);
      return bandResult(band.interval, rule, 1, `Your revenue band (${band.label})`, (v) => `$${commas(v)}`, 'revenue');
    }

    case 'project_cost': {
      if (!profile.cost || profile.cost === 'unsure') {
        return result('unknown', profile.cost === 'unsure' ? 'You weren\'t sure of the project cost.' : 'You didn\'t give a project cost.', 'not_answered');
      }
      const band = COST.find((c) => c.id === profile.cost);
      return bandResult(band.interval, rule, 1, `Your project cost band (${band.label})`, (v) => `$${commas(v)}`, 'project cost');
    }

    default:
      return result('unknown', 'This rule can\'t be checked.', 'self_check');
  }
}

function bandResult(interval, rule, scale, subject, fmt) {
  const limit = boundsWords(rule, fmt);
  const cmp = compareInterval(interval, rule, scale);
  if (cmp === 'met') return result('met', `${subject} fits. The page says ${limit}.`);
  if (cmp === 'missed') return result('missed', `${subject} is outside the page's limit. The page says ${limit}.`);
  return result('unknown', `${subject} is on both sides of the page's limit. The page says ${limit}.`, 'band_straddles');
}

// ---- dates ---------------------------------------------------------------------------------------------------

function toDate(now) {
  if (now instanceof Date) return now;
  if (now === undefined || now === null) return new Date();
  return new Date(now);
}

/** YYYY-MM-DD for an instant, in Newfoundland time. */
export function localDate(instant) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(toDate(instant));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---- one program ---------------------------------------------------------------------------------------------

/** A quoted fact from a bundle (already expanded) or a raw record (expanded here, context null). */
function toQuote(obj, sourcesById) {
  return {
    quote: obj.quote,
    source: obj.source,
    source_url: obj.source_url ?? sourcesById[obj.source]?.url ?? null,
    context: obj.context ?? null,
  };
}

/** evaluateProgram(program, profile | null, { now, sourceStatus }) → ProgramResult */
export function evaluateProgram(program, profile, { now, sourceStatus = {} } = {}) {
  const at = toDate(now);
  const sourcesById = Object.fromEntries(program.sources.map((s) => [s.id, s]));
  const q = (obj) => toQuote(obj, sourcesById);

  // Intake, with a passed deadline closing an open program.
  const stated = program.intake.status;
  let status = stated;
  let note = null;
  const deadline = program.intake.deadline ? { date: program.intake.deadline.date, ...q(program.intake.deadline) } : null;
  if (stated === 'open' && deadline && deadline.date < localDate(at)) {
    status = 'closed';
    note = 'The deadline on the page has passed.';
  }
  const intake = {
    status,
    stated_status: stated,
    label: INTAKE_LABELS[status],
    note,
    quote: program.intake.quote ? q(program.intake) : null,
    deadline,
  };

  // Verification.
  let oldest = null;
  let needsReview = false;
  let missingQuotes = 0;
  let lastChecked = null;
  for (const s of program.sources) {
    const st = sourceStatus[s.id];
    const verified = st?.last_verified_at ?? s.fetched_at;
    if (oldest === null || new Date(verified) < new Date(oldest)) oldest = verified;
    if (st && (st.missing_quotes > 0 || st.page_gone)) needsReview = true;
    if (st && st.missing_quotes > 0) missingQuotes += st.missing_quotes;
    if (st?.last_checked_at && (lastChecked === null || new Date(st.last_checked_at) > new Date(lastChecked))) {
      lastChecked = st.last_checked_at;
    }
  }
  const ageDays = Math.max(0, Math.floor((at - new Date(oldest)) / DAY_MS));
  const verification = {
    last_verified: localDate(oldest),
    age_days: ageDays,
    stale: ageDays > STALE_DAYS,
    needs_review: needsReview,
    missing_quotes: missingQuotes,
    last_checked_at: lastChecked,
  };

  // Criteria.
  const counts = { met: 0, missed: 0, unknown: 0, self_check: 0 };
  const criteria = program.criteria.map((c) => {
    const ev = profile ? evaluateCriterion(c, profile) : { status: null, unknown_reason: null, why: null };
    if (profile) {
      counts[ev.status] += 1;
      if (ev.unknown_reason === 'self_check') counts.self_check += 1;
    }
    return { id: c.id, text: c.text, kind: c.rule.kind, rule: c.rule, ...ev, ...q(c) };
  });

  const fit = profile ? fitFor({ criteria, intake, verification }) : null;

  const fundingTypes = program.funding_types.map((f) => ({
    type: f.type, label: labelOf(FUNDING_TYPES, f.type), applies_to: f.applies_to ?? null, ...q(f),
  }));
  let bestType = null;
  for (const f of fundingTypes) if (bestType === null || TYPE_RANK[f.type] < TYPE_RANK[bestType]) bestType = f.type;

  const unknownFacts = [];
  if (stated === 'unknown') unknownFacts.push('intake');
  if (!program.max_amount) unknownFacts.push('max_amount');
  if (!program.cost_share) unknownFacts.push('cost_share');
  if (program.funding_types.length === 0) unknownFacts.push('funding_types');

  return {
    slug: program.slug,
    sample: program.sample,
    name: program.name,
    provider: program.provider,
    level: program.level,
    url: program.url,
    summary: q(program.summary),
    funding_types: fundingTypes,
    best_type: bestType,
    intake,
    max_amount: program.max_amount ? { amount: program.max_amount.amount, text: program.max_amount.text, ...q(program.max_amount) } : null,
    cost_share: program.cost_share ? { percent: program.cost_share.percent, text: program.cost_share.text, ...q(program.cost_share) } : null,
    contacts: program.contacts.map((c) => ({
      label: c.label, phone: c.phone ?? null, email: c.email ?? null, census_divisions: c.census_divisions ?? null, ...q(c),
    })),
    criteria,
    counts,
    fit,
    verification,
    unknown_facts: unknownFacts,
    sources: program.sources.map((s) => ({ id: s.id, url: s.url, title: s.title, publisher: s.publisher, fetched_at: s.fetched_at })),
  };
}

function fitFor({ criteria, intake, verification }) {
  const missed = criteria.filter((c) => c.status === 'missed');
  const checkable = criteria.filter((c) => c.unknown_reason !== 'self_check');
  const unknown = checkable.filter((c) => c.status === 'unknown');
  const selfChecks = criteria.filter((c) => c.unknown_reason === 'self_check');
  const why = [];

  if (intake.status === 'closed') {
    why.push(intake.note ? `Not taking applications right now. ${intake.note}` : 'Not taking applications right now.');
    for (const c of missed) why.push(`Doesn't match: ${c.text}.`);
    return { ...FIT.doesnt, why };
  }
  if (missed.length) {
    for (const c of missed) why.push(`Doesn't match: ${c.text}.`);
    return { ...FIT.doesnt, why };
  }

  for (const c of unknown) {
    if (c.unknown_reason === 'band_straddles') why.push(`Unknown, your answer is close to the page's limit: ${c.text}.`);
    else if (c.unknown_reason === 'unclear') why.push(`Unknown, the page's wording doesn't settle it for your answer: ${c.text}.`);
    else why.push(`Unknown, you didn't answer this: ${c.text}.`);
  }
  const allMet = unknown.length === 0;
  const beyondLocation = checkable.some((c) => c.kind !== 'location');
  if (!beyondLocation) {
    why.push(checkable.length
      ? 'Only your location can be checked against the page.'
      : 'None of the page\'s conditions can be checked from your answers.');
  }
  const intakeOk = intake.status === 'open' || intake.status === 'continuous';
  if (!intakeOk) {
    why.push(intake.status === 'upcoming'
      ? 'Not open for applications yet.'
      : 'The page doesn\'t say whether it is taking applications.');
  }
  if (verification.stale) why.push(`Last verified ${verification.age_days} days ago, more than ${STALE_DAYS} days. Check the official page.`);
  if (verification.needs_review) why.push('The page has changed or gone since we checked it. Check the official page.');

  if (allMet && beyondLocation && intakeOk && !verification.stale && !verification.needs_review) {
    const looks = ['Everything your answers can check matches the page.'];
    if (selfChecks.length) {
      looks.push(`Check ${selfChecks.length === 1 ? '1 thing' : `${selfChecks.length} things`} yourself.`);
    }
    return { ...FIT.looks, why: looks };
  }
  if (selfChecks.length) why.push(`Check ${selfChecks.length === 1 ? '1 thing' : `${selfChecks.length} things`} yourself.`);
  return { ...FIT.might, why };
}

// ---- many programs -------------------------------------------------------------------------------------------

/** matchPrograms(programs, profile, { now, sourceStatus }) → { open, closed, counts } */
export function matchPrograms(programs, profile, opts = {}) {
  const results = programs.map((p) => evaluateProgram(p, profile, opts));
  const open = results.filter((r) => r.intake.status !== 'closed');
  const closed = results.filter((r) => r.intake.status === 'closed');
  const typeRank = (r) => (r.best_type === null ? 5 : TYPE_RANK[r.best_type]);
  const fitRank = (r) => (r.fit ? r.fit.rank : 0);
  open.sort((a, b) => fitRank(a) - fitRank(b)
    || typeRank(a) - typeRank(b)
    || a.counts.missed - b.counts.missed
    || a.counts.unknown - b.counts.unknown
    || a.name.localeCompare(b.name, 'en'));
  closed.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const counts = { looks: 0, might: 0, doesnt: 0, closed: closed.length };
  for (const r of open) {
    if (!r.fit) continue;
    if (r.fit.rank === 0) counts.looks += 1;
    else if (r.fit.rank === 1) counts.might += 1;
    else counts.doesnt += 1;
  }
  return { open, closed, counts };
}
