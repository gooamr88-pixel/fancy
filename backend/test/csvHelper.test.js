const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, generateCSV, sanitizeCsvValue } = require('../utils/csvHelper');

test('parseCSV maps headers to row objects', () => {
  const rows = parseCSV('guest_name,email,party_size\nAlice,alice@example.com,2');
  assert.deepEqual(rows, [{ guest_name: 'Alice', email: 'alice@example.com', party_size: '2' }]);
});

test('parseCSV handles quoted fields containing commas and escaped quotes', () => {
  const rows = parseCSV('guest_name,notes\n"Smith, Jr.","He said ""hi"""');
  assert.equal(rows[0].guest_name, 'Smith, Jr.');
  assert.equal(rows[0].notes, 'He said "hi"');
});

test('parseCSV tolerates CRLF line endings and skips blank lines', () => {
  const rows = parseCSV('guest_name,email\r\nBob,bob@example.com\r\n\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].guest_name, 'Bob');
});

test('parseCSV returns [] for empty or header-only input', () => {
  assert.deepEqual(parseCSV(''), []);
  assert.deepEqual(parseCSV('guest_name,email'), []);
});

test('sanitizeCsvValue neutralizes formula-injection prefixes', () => {
  assert.equal(sanitizeCsvValue('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(sanitizeCsvValue('+1234'), "'+1234");
  assert.equal(sanitizeCsvValue('-1'), "'-1");
  assert.equal(sanitizeCsvValue('@cmd'), "'@cmd");
  assert.equal(sanitizeCsvValue('safe value'), 'safe value');
});

test('generateCSV quotes headers, escapes quotes, and sanitizes cells', () => {
  const csv = generateCSV(
    ['name', 'note'],
    [{ name: '=danger', note: 'a "b" c' }],
    (item) => [item.name, item.note]
  );
  const [header, row] = csv.split('\n');
  assert.equal(header, '"name","note"');
  // formula prefix neutralized, inner quotes doubled
  assert.equal(row, '"\'=danger","a ""b"" c"');
});

test('generateCSV renders null/undefined as empty strings', () => {
  const csv = generateCSV(['a', 'b'], [{}], () => [null, undefined]);
  assert.equal(csv.split('\n')[1], '"",""');
});
