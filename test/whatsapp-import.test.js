import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, extractUrls, importableWhatsAppLinks, parseWhatsAppMessages } from '../public/whatsapp.js';

test('extracts and canonicalizes unique links from a WhatsApp communication',()=>{
  const text='Check this https://example.com/article?utm_source=wa#top and again https://example.com/article/ plus https://github.com/org/repo';
  assert.deepEqual(extractUrls(text),['https://example.com/article','https://github.com/org/repo']);
});

test('bulk WhatsApp import keeps only unique URLs and discards timestamps, user names and message text',()=>{
  const text='12/09/2026, 10:31 - Sourabh: Read https://example.com/one\n13/09/2026, 11:02 - Richa: Another https://example.org/two\n13/09/2026, 11:03 - Richa: Duplicate https://example.com/one';
  const records=parseWhatsAppMessages(text);
  assert.equal(records.length,3);
  assert.deepEqual(importableWhatsAppLinks(text),[{url:'https://example.com/one'},{url:'https://example.org/two'}]);
  assert.deepEqual(importableWhatsAppLinks(text).map(x=>Object.keys(x)),[['url'],['url']]);
});

test('parses bracketed iOS-style timestamps and multiline messages without importing literals',()=>{
  const text='[12/09/26, 10:31:05] Sourabh: Here is the first link https://example.com/a\nmore context\n[12/09/26, 10:32:05] Sourabh: Second https://example.com/b';
  const links=importableWhatsAppLinks(text);
  assert.deepEqual(links,[{url:'https://example.com/a'},{url:'https://example.com/b'}]);
});

test('rejects non-http links during canonicalization',()=>{
  assert.throws(()=>canonicalizeUrl('javascript:alert(1)'),/Only http and https/);
});
