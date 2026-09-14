import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageText, numbersIn, contextFor } from '../text.js';
import { sha256Hex } from '../hash.js';
import { sampleHtml } from './helpers.mjs';

test('pageText: inline tags join, block tags become one space', () => {
  assert.equal(pageText('<p>Sm<b>all</b> <span>bus</span>iness</p><div>a</div><div>b</div>'), 'Small business a b');
  assert.equal(pageText('<li>one</li><li>two</li><br>three<hr/>four'), 'one two three four');
  assert.equal(pageText('<p>a<a href="/x">b</a>c<abbr>d</abbr><br>e</p>'), 'abcd e');
  // <b> is inline but <br> and <section> are not, even though they share first letters.
  assert.equal(pageText('x<section>y</section>z'), 'x y z');
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

test('contextFor cuts at word boundaries with …', () => {
  const text = 'one two three four five six seven eight nine ten QUOTE HERE eleven twelve thirteen fourteen';
  assert.deepEqual(contextFor(text, 'QUOTE HERE', 12), { before: '…nine ten ', after: ' eleven…' });
  assert.deepEqual(contextFor(text, 'one two', 500), { before: '', after: text.slice(7) });
  assert.equal(contextFor(text, 'not there'), null);
  const ctx = contextFor(text, 'five six');
  assert.equal(ctx.before, 'one two three four ');
});

test('sha256Hex of a string and of bytes agree', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), await sha256Hex('abc'));
});
