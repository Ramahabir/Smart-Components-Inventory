import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail } from '../lib/email';

const valid = [
  'user@example.com',
  'first.last+tag@sub.example.co.uk',
  "o'hara+tag@example.com",
  'user@localhost.dev',
  '  padded@example.com  ',
];

const invalid = [
  'plainaddress',
  'missing@tld',
  '@example.com',
  'user@',
  'user@@example.com',
  'user name@example.com',
  'user@exa mple.com',
  'user@-example.com',
  'user@example-.com',
  'user@example..com',
  'user..name@example.com',
  'user@.example.com',
  'user@example.com.',
  'user@example.com..',
  'user@example.c',
  `${'a'.repeat(65)}@example.com`,
  `${'user@' + 'example.'.repeat(60)}com`,
];

test('isValidEmail accepts well-formed addresses', () => {
  for (const email of valid) assert.equal(isValidEmail(email), true, email);
});

test('isValidEmail rejects malformed addresses', () => {
  for (const email of invalid) assert.equal(isValidEmail(email), false, email);
});

test('isValidEmail handles non-string inputs', () => {
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('   '), false);
});
