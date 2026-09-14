// Page text, numbers and quote context — docs/API.md §1. Pure ESM, no dependencies.

const REMOVED_ELEMENTS = ['head', 'script', 'style', 'noscript', 'template', 'svg'];

const INLINE_TAGS = [
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'font', 'i', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
];

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  hellip: '…', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™',
  bull: '•', middot: '·', deg: '°', times: '×', cent: '¢', pound: '£',
  euro: '€', frac12: '½', frac14: '¼', frac34: '¾', shy: '',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', agrave: 'à', Agrave: 'À',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û', ccedil: 'ç',
  Ccedil: 'Ç', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü',
};

const ELEMENT_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
// An unclosed removed element (e.g. a truncated page) swallows to the end, as a browser would.
const UNCLOSED_ELEMENT_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])[^>]*>[\\s\\S]*$`, 'gi');
const SELF_CLOSED_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])[^>]*\\/>`, 'gi');
const INLINE_RE = new RegExp(`<\\/?(?:${INLINE_TAGS.join('|')})(?=[\\s/>])[^>]*>`, 'gi');
const OTHER_TAG_RE = /<\/?[a-zA-Z][^>]*>|<![^>]*>|<\?[^>]*>/g;
const ENTITY_RE = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g;

function decodeEntities(s) {
  return s.replace(ENTITY_RE, (whole, dec, hex, name) => {
    if (dec !== undefined || hex !== undefined) {
      const cp = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return whole;
      try { return String.fromCodePoint(cp); } catch { return whole; }
    }
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
  });
}

/** Deterministic visible text of an HTML page (docs/API.md §1). */
export function pageText(html) {
  let s = String(html ?? '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(SELF_CLOSED_RE, '');
  s = s.replace(ELEMENT_RE, '');
  s = s.replace(UNCLOSED_ELEMENT_RE, '');
  s = s.replace(INLINE_RE, '');
  s = s.replace(OTHER_TAG_RE, ' ');
  s = decodeEntities(s);
  s = s.replace(/[   ]/g, ' ').replace(/[​﻿]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

const MULTIPLIERS = { thousand: 1e3, million: 1e6, billion: 1e9 };
const NUMBER_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(thousand|million|billion)\b)?/gi;

/** Every number written in the text (docs/API.md §1). */
export function numbersIn(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(NUMBER_RE)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    out.push(n);
    if (m[2]) {
      const scaled = Math.round(n * MULTIPLIERS[m[2].toLowerCase()] * 100) / 100;
      out.push(scaled);
    }
  }
  return out;
}

/** Up to n characters either side of the first occurrence of quote, cut back to a word boundary. */
export function contextFor(text, quote, n = 160) {
  if (!quote) return null;
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  const end = idx + quote.length;

  let before = text.slice(Math.max(0, idx - n), idx);
  if (idx - n > 0) {
    // Drop the partial first word unless the cut already landed on a boundary.
    if (!/\s/.test(text[idx - n - 1])) {
      const sp = before.search(/\s/);
      before = sp >= 0 ? before.slice(sp + 1) : '';
    }
    before = '…' + before.replace(/^\s+/, '');
  }

  let after = text.slice(end, end + n);
  if (end + n < text.length) {
    if (!/\s/.test(text[end + n])) {
      const sp = after.search(/\s[^\s]*$/);
      after = sp >= 0 ? after.slice(0, sp) : '';
    }
    after = after.replace(/\s+$/, '') + '…';
  }
  return { before, after };
}
