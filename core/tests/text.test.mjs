import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pageText, blockText, numbersIn, contextFor } from '../text.js';
import { sha256Hex } from '../hash.js';
import { quotesOf } from '../verify.js';
import { sampleHtml, ROOT } from './helpers.mjs';

test('pageText: inline tags join, block tags become one space', () => {
  assert.equal(pageText('<p>Sm<b>all</b> <span>bus</span>iness</p><div>a</div><div>b</div>'), 'Small business a b');
  assert.equal(pageText('<li>one</li><li>two</li><br>three<hr/>four'), 'one two three four');
  assert.equal(pageText('<p>a<a href="/x">b</a>c<abbr>d</abbr><br>e</p>'), 'abcd e');
  // <b> is inline but <br> and <section> are not, even though they share first letters.
  assert.equal(pageText('x<section>y</section>z'), 'x y z');
});

test('pageText: a tag ends at the first > outside a quoted attribute value', () => {
  assert.equal(pageText('<div data-x="a > b">Hello world</div>'), 'Hello world');
  assert.equal(pageText("<p title='x > y'>One</p><p>Two</p>"), 'One Two');
  assert.equal(pageText('Go <a href="/x" data-note="1 > 0">here</a> now'), 'Go here now', 'inline tag joins');
  assert.equal(pageText('<script data-cfg="a>b">var s = "<p>no</p>";</script><p>kept</p>'), 'kept', 'removed element');
  const escaped = '<div class="cmp" data-cmp-data-layer="{&quot;h&quot;:&quot;&lt;p&gt;Duplicate sentence.&lt;/p&gt;&quot;, &quot;x&quot;: &quot;&gt;&quot;}">Real sentence.</div>';
  assert.equal(pageText(escaped), 'Real sentence.', 'escaped HTML in a data attribute never leaks');
  assert.equal(pageText('<p class="a" id=b>Text</p>'), 'Text', 'unquoted attributes still end at >');
});

test('blockText: block edges become one \\n, everything else as pageText', () => {
  assert.equal(blockText('<p>One</p><p>Two</p>'), 'One\nTwo');
  assert.equal(blockText('<ul>\n  <li>Central: 1</li>\n  <li>Eastern: 2</li>\n</ul>'), 'Central: 1\nEastern: 2', 'a run with an edge is one \\n');
  assert.equal(blockText('<p>Sm<b>all</b> <span>bus</span>iness</p>'), 'Small business', 'inline tags still join');
  assert.equal(blockText('<p>line one\nline two</p>'), 'line one line two', 'a newline in the source is not a block edge');
  assert.equal(blockText('Call us<br>709-555-0101'), 'Call us\n709-555-0101');
  assert.equal(blockText('<p>a <x-card>b</x-card> c</p>'), 'a b c', 'unknown tags stay a space');
  assert.equal(blockText('<td>a</td><td>b</td><x-card>c</x-card>'), 'a\nb\nc', 'a run touching an edge is one \\n even with other tags in it');
  assert.equal(blockText('<div data-x="a > b">Hello</div><div>world</div>'), 'Hello\nworld');
  assert.equal(blockText('\n<main>\n<h1>T</h1>\n</main>\n'), 'T', 'trimmed both ends');
  assert.equal(blockText('<p>&#xE000;</p><p>x</p>'), '\nx', 'an entity that makes the marker character is kept as text');
  for (const html of [
    '<p>One</p><p>Two</p>', '<p>a&nbsp;  b</p><div>​c﻿</div>', '<nav><a>Home</a> &gt; <a>Funding</a>:</nav><p>Closed.</p>',
    '<!-- x --><head><title>t</title></head><body>\n<p>x</p>\n\n<p>y</p></body>', '<p>&#xE000; and </p><br/><hr>z',
  ]) {
    assert.equal(blockText(html).replace(/\n/g, ' '), pageText(html), html);
  }
});

test('blockText invariant over every saved page: blockText(html) with \\n as spaces === pageText(html)', () => {
  const dirs = [path.join(ROOT, 'data', 'sources'), path.join(ROOT, 'core', 'tests', 'fixtures', 'sources')];
  let n = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      const block = blockText(html);
      assert.equal(block.replace(/\n/g, ' '), pageText(html), `${f}: blockText and pageText differ`);
      assert.ok(!/\n\n| \n|\n /.test(block), `${f}: a whitespace run with an edge must be exactly one \\n`);
      n += 1;
    }
  }
  assert.ok(n >= 65, `checked ${n} pages (54 saved .html in data/sources, the census source is a zip, plus 11 SAMPLE)`);
});

test('pageText: entities, &nbsp; and invisible characters', () => {
  assert.equal(pageText('It&rsquo;s &#8217;&#x2019; &amp; &lt;b&gt; &unknown; x&shy;y &eacute;'), 'It’s ’’ & <b> &unknown; xy é');
  assert.equal(pageText('50&nbsp;per cent now ok'), '50 per cent now ok');
  assert.equal(pageText('zero​width﻿ mark'), 'zerowidth mark');
  assert.equal(pageText('  lots \n\t of   space  '), 'lots of space');
});

test('pageText: head, script, style, noscript, template, svg and comments are gone', () => {
  const html = '<html><head><title>Title</title></head><body><script>var a = "<p>no</p>";</script><style>p{}</style>'
    + '<noscript>nojs</noscript><template><p>tpl</p></template><svg viewBox="0 0 1 1"><text>icon</text></svg>'
    + '<!-- a comment --><p>kept</p><SCRIPT type="x">upper</SCRIPT></body></html>';
  assert.equal(pageText(html), 'kept');
});

test('pageText on the messy SAMPLE pages', () => {
  const growth = pageText(sampleHtml('nl-sample-growth-grant--main'));
  assert.ok(growth.startsWith('Home Funding Contact us SAMPLE Growth Grant'), 'nav menu items are spaced');
  assert.ok(growth.includes('is a non-repayable contribution'), '<strong> inside a sentence joins');
  assert.ok(growth.includes('Businesses with fewer than 100 employees'), '&nbsp; becomes a space');
  assert.ok(growth.includes('It’s best to talk to us before you apply.'), '&rsquo; and <em> inside a sentence');
  assert.ok(!growth.includes('tracking') && !growth.includes('promo') && !growth.includes('500'), 'script and style gone');
  assert.ok(!growth.includes('$80,000'), 'comment gone');
  assert.ok(!growth.includes('|'), 'head title gone');

  const wage = pageText(sampleHtml('nl-sample-wage-subsidy--main'));
  assert.ok(wage.includes('up to 60% of wages'), 'numeric entity &#37;');
  assert.ok(wage.includes('close October 15, 2026.'));
  assert.ok(!wage.includes('October 1,') && !wage.includes('JavaScript'), 'template and noscript gone');

  const women = pageText(sampleHtml('nl-sample-women-entrepreneur-loan--main'));
  assert.ok(women.includes('709‑555‑0199'), 'non-breaking hyphens are kept, not normalised');
});

test('numbersIn', () => {
  assert.deepEqual(numbersIn('$1,500,000'), [1500000]);
  assert.deepEqual(numbersIn('$1.5 million'), [1.5, 1500000]);
  assert.deepEqual(numbersIn('50 per cent'), [50]);
  assert.deepEqual(numbersIn('50%'), [50]);
  assert.deepEqual(numbersIn('fewer than 100 employees'), [100]);
  assert.deepEqual(numbersIn('24 months'), [24]);
  assert.deepEqual(numbersIn('2.5 times'), [2.5]);
  assert.deepEqual(numbersIn('$300 thousand and $2 billion'), [300, 300000, 2, 2000000000]);
  assert.deepEqual(numbersIn('no numbers here'), []);
});

test('contextFor gives the rest of the sentence, never menu text', () => {
  const text = 'Home Funding Contact us Programs Who can apply. Owners must live here and the business must operate in NL; it can be seasonal. Next sentence here.';
  assert.deepEqual(contextFor(text, 'the business must operate in NL'), { before: 'Owners must live here and ', after: ';' });
  assert.deepEqual(contextFor(text, 'it can be seasonal'), { before: '', after: '.' }, 'starts right after a boundary');
  assert.deepEqual(contextFor(text, 'Who can apply'), { before: '', after: '.' }, 'a menu has no boundary, so no before');
  assert.deepEqual(contextFor(text, 'Next sentence here.'), { before: '', after: '' }, 'a quote that ends its sentence');
  assert.deepEqual(contextFor(text, 'and the business', 5), { before: '', after: '' }, 'no boundary within n');
  assert.deepEqual(contextFor('Call us: 709-555-0101 today! Or write.', '709-555-0101'), { before: '', after: ' today!' });
  assert.equal(contextFor(text, 'not there'), null);

  const growth = pageText(sampleHtml('nl-sample-growth-grant--main'));
  for (const quote of ['Businesses with fewer than 100 employees', 'Up to $50,000 per project', 'Applicants must have a business plan']) {
    const ctx = contextFor(growth, quote);
    assert.ok(!`${ctx.before}${ctx.after}`.includes('Home Funding'), `${quote}: menu text in context`);
    assert.ok(!`${ctx.before}${ctx.after}`.includes('…'));
  }
});

test('contextFor on blockText stops at block edges too; \\n never in the output', () => {
  // SAMPLE office list: on page text the context runs into the other offices' numbers.
  const offices = '<ul><li>Central: 709-555-0101</li><li>Eastern: 709-555-0102</li><li>Western: 709-555-0103</li></ul>';
  assert.deepEqual(contextFor(pageText(offices), 'Eastern: 709-555-0102'), { before: '709-555-0101 ', after: ' Western:' }, 'the old leak');
  assert.deepEqual(contextFor(blockText(offices), 'Eastern: 709-555-0102'), { before: '', after: '' });

  // SAMPLE breadcrumb with a colon in it, in front of a closed notice.
  const crumb = '<nav><a href="/">Home</a> &gt; <a href="/funding/">Funding: SAMPLE grants</a></nav><div class="alert"><p>The SAMPLE Grant is not accepting applications.</p></div>';
  assert.deepEqual(contextFor(pageText(crumb), 'The SAMPLE Grant is not accepting applications.'), { before: 'SAMPLE grants ', after: '' }, 'the old leak');
  assert.deepEqual(contextFor(blockText(crumb), 'The SAMPLE Grant is not accepting applications.'), { before: '', after: '' });

  // Sentences still bound context inside a block; an edge ends it before any boundary.
  const para = '<p>Owners must live here. The business must operate in NL; it can be seasonal.</p><p>Apply by phone</p><p>Next line.</p>';
  const b = blockText(para);
  assert.deepEqual(contextFor(b, 'The business must operate in NL'), { before: '', after: ';' });
  assert.deepEqual(contextFor(b, 'must operate'), { before: 'The business ', after: ' in NL;' });
  assert.deepEqual(contextFor(b, 'Apply by'), { before: '', after: ' phone' }, 'after stops at the edge, edge not included');
  assert.deepEqual(contextFor(b, 'it can be seasonal'), { before: '', after: '.' }, 'a boundary right before an edge still counts');

  // A quote that spans block edges (table cells) is still found, by page-text index.
  const cells = '<table><tr><td>SAMPLE Central Office</td><td>709-555-0101</td></tr><tr><td>Eastern</td></tr></table>';
  assert.deepEqual(contextFor(blockText(cells), 'SAMPLE Central Office 709-555-0101'), { before: '', after: '' });
  assert.equal(contextFor(blockText(cells), 'not there'), null);
});

test('real pages: CanExport\'s closed intake has no breadcrumb before it; no context of any real quote holds \\n', () => {
  const page = (id) => blockText(fs.readFileSync(path.join(ROOT, 'data', 'sources', `${id}.html`), 'utf8'));
  const canexport = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'programs', 'ca-canexport-smes.json'), 'utf8'));
  const intake = contextFor(page(canexport.intake.source), canexport.intake.quote);
  assert.ok(intake, 'intake quote found');
  assert.ok(!/Trade Commissioner Service|Our solutions|CanExport SMEs $/.test(intake.before), `breadcrumb in before: ${JSON.stringify(intake.before)}`);

  // Business Growth regional offices: no office's context runs into another office's number.
  const growth = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'programs', 'nl-business-growth-program.json'), 'utf8'));
  const phones = growth.contacts.filter((c) => c.phone).map((c) => c.phone.replace(/\D/g, ''));
  assert.equal(phones.length, 5);
  for (const c of growth.contacts) {
    const ctx = contextFor(page(c.source), c.quote);
    const around = `${ctx.before}${ctx.after}`.replace(/\D/g, '');
    for (const other of phones) {
      if (c.phone && other === c.phone.replace(/\D/g, '')) continue;
      assert.ok(!around.includes(other), `${c.label}: context holds another office's number ${other}: ${JSON.stringify(ctx)}`);
    }
  }

  let quotes = 0;
  let total = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'data', 'programs')).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'programs', f), 'utf8'));
    const texts = {};
    const all = quotesOf(r); // every quote, the way the build and the live check count them
    total += all.length;
    for (const q of all) {
      texts[q.source] ??= page(q.source);
      const ctx = contextFor(texts[q.source], q.quote);
      assert.ok(ctx, `${f} ${q.path}: quote not found in blockText: ${q.quote.slice(0, 60)}`);
      assert.ok(!ctx.before.includes('\n') && !ctx.after.includes('\n'), `${f} ${q.path}: \\n in context`);
      quotes += 1;
    }
  }
  assert.equal(quotes, total, 'every real quote checked');
  assert.ok(total > 250, `only ${total} real quotes found`);
});

test('sha256Hex of a string and of bytes agree', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), await sha256Hex('abc'));
});
