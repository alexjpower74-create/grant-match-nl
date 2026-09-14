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

// The inside of a tag: anything up to the first `>` that is outside a quoted attribute value (API §1). Pages put `>`
// and whole escaped HTML inside data-* attributes, and that must never become page text.
const ATTRS = `(?:"[^"]*"|'[^']*'|[^'">])*`;
const ELEMENT_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])${ATTRS}>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
// An unclosed removed element (e.g. a truncated page) swallows to the end, as a browser would.
const UNCLOSED_ELEMENT_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])${ATTRS}>[\\s\\S]*$`, 'gi');
const SELF_CLOSED_RE = new RegExp(`<(${REMOVED_ELEMENTS.join('|')})(?=[\\s/>])${ATTRS}\\/>`, 'gi');
const INLINE_RE = new RegExp(`<\\/?(?:${INLINE_TAGS.join('|')})(?=[\\s/>])${ATTRS}>`, 'gi');
const OTHER_TAG_RE = new RegExp(`<\\/?[a-zA-Z]${ATTRS}>|<![^>]*>|<\\?[^>]*>`, 'g');
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

const BLOCK_TAGS = new Set([
  'p', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'section', 'article', 'aside',
  'nav', 'header', 'footer', 'main', 'table', 'tr', 'td', 'th', 'br', 'hr', 'blockquote', 'pre', 'form', 'fieldset',
  'figure', 'figcaption', 'address',
]);
const TAG_NAME_RE = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/;

/**
 * Page text with block edges as "\n" (docs/API.md §1). Exactly the pageText steps, except that a block tag becomes
 * a marker instead of a space; a whitespace run containing a marker collapses to "\n", any other run to one space.
 * The marker is a private-use character absent from the page (and not produced by its entities), so source newlines
 * never become block edges and blockText(html).replace(/\n/g, ' ') === pageText(html) with identical indexes.
 */
export function blockText(html) {
  const src = String(html ?? '');
  for (let cp = 0xe000; cp <= 0xf8ff; cp++) {
    const mark = String.fromCodePoint(cp);
    if (src.includes(mark)) continue;
    let inserted = 0;
    let s = src;
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(SELF_CLOSED_RE, '');
    s = s.replace(ELEMENT_RE, '');
    s = s.replace(UNCLOSED_ELEMENT_RE, '');
    s = s.replace(INLINE_RE, '');
    s = s.replace(OTHER_TAG_RE, (tag) => {
      const name = tag.match(TAG_NAME_RE)?.[1];
      if (name && BLOCK_TAGS.has(name.toLowerCase())) {
        inserted += 1;
        return mark;
      }
      return ' ';
    });
    s = decodeEntities(s);
    if (s.split(mark).length - 1 !== inserted) continue; // an entity produced the marker: pick another
    s = s.replace(/[   ]/g, ' ').replace(/[​﻿]/g, '');
    s = s.replace(new RegExp(`[\\s${mark}]+`, 'g'), (run) => (run.includes(mark) ? '\n' : ' '));
    return s.replace(/^[ \n]+|[ \n]+$/g, '');
  }
  throw new Error('blockText: no free marker character');
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
