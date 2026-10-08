const { placeInTree } = require('../src/core/pageTree');

const { assert } = require('./assert');

const flat = placeInTree([{ id: '1', ancestors: ['100', '200'], slug: 'catalogue' }], new Map());
assert(flat.get('1') === 'catalogue', 'page with no known ancestors goes to the root');

const pair = placeInTree([
  { id: '2', ancestors: ['100', '1'], slug: 'books' },
  { id: '1', ancestors: ['100'], slug: 'catalogue' }
], new Map());
assert(pair.get('1') === 'catalogue' && pair.get('2') === 'catalogue/books',
  'child in the parent subfolder, got: ' + pair.get('2'));

const deep = placeInTree([
  { id: '3', ancestors: ['100', '1', '2'], slug: 'loans' },
  { id: '2', ancestors: ['100', '1'], slug: 'books' },
  { id: '1', ancestors: ['100'], slug: 'catalogue' }
], new Map());
assert(deep.get('3') === 'catalogue/books/loans',
  'grandchild two levels deep, got: ' + deep.get('3'));

const collapsed = placeInTree([
  { id: '1', ancestors: ['100'], slug: 'catalogue' },
  { id: '3', ancestors: ['100', '1', '2'], slug: 'loans' }
], new Map());
assert(collapsed.get('3') === 'catalogue/loans',
  'a missing tree level is skipped, got: ' + collapsed.get('3'));

const known = new Map([['1', 'docs/catalogue']]);
const under = placeInTree([{ id: '2', ancestors: ['100', '1'], slug: 'books' }], known);
assert(under.get('2') === 'docs/catalogue/books',
  'child under a previously saved file, got: ' + under.get('2'));

const stay = placeInTree([
  { id: '2', ancestors: ['100', '1'], slug: 'books' },
  { id: '1', ancestors: ['100'], slug: 'catalogue' }
], new Map([['2', 'books']]));
assert(stay.get('2') === 'books', 'an already saved file is not moved');

const none = placeInTree([{ id: '1', slug: 'catalogue' }], new Map());
assert(none.get('1') === 'catalogue', 'missing ancestors does not break placement');

const sub = placeInTree([
  { id: '2', ancestors: ['100', '1'], slug: 'books' },
  { id: '1', ancestors: ['100'], slug: 'catalogue' }
], new Map(), 'services/account');
assert(sub.get('1') === 'services/account/catalogue' && sub.get('2') === 'services/account/catalogue/books',
  'new pages go into the chosen subfolder, got: ' + sub.get('1') + ', ' + sub.get('2'));
assert(placeInTree([{ id: '2', ancestors: ['1'], slug: 'books' }], known, 'services').get('2') === 'docs/catalogue/books',
  'a child of a saved page still goes under its parent');
assert(placeInTree([{ id: '1', slug: 'catalogue' }], new Map([['1', 'old/catalogue']]), 'services').get('1') === 'old/catalogue',
  'an already saved page stays where it is');

console.log('PASS: page tree placement ok');
