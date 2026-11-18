import assert from 'node:assert/strict';
import { keptEntries, readSettings } from './viewStyles';

assert.equal(readSettings(null), null);
assert.equal(readSettings({ params: {}, extra: true }), null);
assert.equal(readSettings({ hidden: ['ok', 1] }), null);
assert.deepEqual(readSettings({}), { params: {}, hidden: [] });
assert.deepEqual(readSettings({ params: { player: { shape: 'arms' } }, hidden: ['player.orange', 'player.orange'] }), {
  params: { player: { shape: 'arms' } },
  hidden: ['player.orange']
});

const entries = [
  { id: 'player.blue', name: 'blue' },
  { id: 'player.orange', name: 'orange' }
];
assert.deepEqual(keptEntries(entries, ['player.orange']).map(entry => entry.name), ['blue']);
assert.equal(keptEntries(entries, []).length, 2);

console.log('view settings ok');
