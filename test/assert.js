function assert(ok, message) {
  if (ok) return;
  console.error('FAIL: ' + message);
  process.exit(1);
}

function same(actual, expected, message) {
  assert(actual === expected, message + '\n  got:      ' + actual + '\n  expected: ' + expected);
}

module.exports = { assert, same };
