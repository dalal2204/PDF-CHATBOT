const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CONCURRENCY, parseConcurrency } = require('../config/ingestion');

test('defaults worker concurrency to two and accepts positive integers', () => {
  assert.equal(DEFAULT_CONCURRENCY, 2);
  assert.equal(parseConcurrency(undefined), 2);
  assert.equal(parseConcurrency('1'), 1);
  assert.equal(parseConcurrency('2'), 2);
  assert.equal(parseConcurrency('12'), 12);
});

test('rejects values that are not positive safe integers', () => {
  for (const value of ['', '  ', '0', '-1', '1.5', '2x', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseConcurrency(value), /INGESTION_CONCURRENCY must be a positive integer/);
  }
});
