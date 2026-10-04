// The one assertion the tests need: a failed check names itself and stops the
// run, so the first problem is the one that is reported.
function assert(ok, message) {
  if (ok) return;
  console.error('FAIL: ' + message);
  process.exit(1);
}

function same(actual, expected, message) {
  assert(actual === expected, message + '\n  got:      ' + actual + '\n  expected: ' + expected);
}

module.exports = { assert, same };
