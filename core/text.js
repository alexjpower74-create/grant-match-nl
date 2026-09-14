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

const BOUNDARY_CHARS = '.?!;:';

/**
 * The rest of the sentence around the first occurrence of quote (docs/API.md §1), never menu text.
 * before = text after the last boundary (". " "? " "! " "; " ": ") within n characters before the quote, else "".
 * after = text up to and including the first boundary character within n characters after the quote, else "".
 * A quote that already ends with a boundary character gets after = "" (it ends its own sentence).
 */
export function contextFor(text, quote, n = 160) {
  if (!quote) return null;
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  const end = idx + quote.length;

  let before = '';
  const beforeWindow = text.slice(Math.max(0, idx - n), idx);
  for (let i = beforeWindow.length - 2; i >= 0; i--) {
    if (BOUNDARY_CHARS.includes(beforeWindow[i]) && beforeWindow[i + 1] === ' ') {
      before = beforeWindow.slice(i + 2);
      break;
    }
  }

  let after = '';
  if (!BOUNDARY_CHARS.includes(quote[quote.length - 1])) {
    const afterWindow = text.slice(end, end + n);
    for (let i = 0; i < afterWindow.length; i++) {
      const next = end + i + 1 < text.length ? text[end + i + 1] : ' ';
      if (BOUNDARY_CHARS.includes(afterWindow[i]) && next === ' ') {
        after = afterWindow.slice(0, i + 1);
        break;
      }
    }
  }
  return { before, after };
}
