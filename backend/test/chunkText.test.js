const test = require('node:test');
const assert = require('node:assert/strict');
const chunkText = require('../utils/chunkText');

test('returns no chunks for empty extracted text', () => {
  assert.deepEqual(chunkText('  \n\t'), []);
});

test('splits long text into bounded chunks with overlap', () => {
  const text = Array.from({ length: 400 }, (_, index) => `word${index}`).join(' ');
  const chunks = chunkText(text, 240, 40);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 240));
  const firstEnd = chunks[0].split(' ').at(-1);
  assert.ok(chunks[1].includes(firstEnd));
});

test('keeps short text together and trims normalized whitespace', () => {
  assert.deepEqual(chunkText('  first\r\n\r\n\r\n second  '), ['first\n\n second']);
});
