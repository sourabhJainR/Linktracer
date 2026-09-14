import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, extractUrls, importableWhatsAppLinks, parseWhatsAppMessages } from '../public/whatsapp.js';

test('extracts and canonicalizes unique links from a WhatsApp communication',()=>{
  const text='Check this https://example.com/article?utm_source=wa#top and again https://example.com/article/ plus https://github.com/org/repo';
  assert.deepEqual(extractUrls(text),['https://example.com/article','https://github.com/org/repo']);
});

test('parses Android-style WhatsApp exported messages and preserves message context',()=>{
  const text='12/09/2026, 10:31 - Sourabh: Read https://example.com/one\n13/09/2026, 11:02 - Richa: Another https://example.org/two';
  const records=parseWhatsAppMessages(text);
  assert.equal(records.length,2);
  const links=importableWhatsAppLinks(text);
  assert.equal(links.length,2);
  assert.equal(links[0].message,'Read');
  assert.equal(links[1].message,'Another');
});

test('parses bracketed iOS-style timestamps and multiline messages',()=>{
  const text='[12/09/26, 10:31:05] Sourabh: Here is the first link https://example.com/a\nmore context\n[12/09/26, 10:32:05] Sourabh: Second https://example.com/b';
  const links=importableWhatsAppLinks(text);
  assert.equal(links.length,2);
  assert.match(links[0].message,/Here is the first link more context/);
  assert.equal(links[1].message,'Second');
});

test('rejects non-http links during canonicalization',()=>{
  assert.throws(()=>canonicalizeUrl('javascript:alert(1)'),/Only http and https/);
});
