import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { addVia, itemAt, moveKnot, removeVia, setTravel } from './edit';

const placed = `object:
  - { arrow.run: { p: { x: 1, y: 2 }, to: { x: 9, y: 2 } } }
`;

let next = addVia(placed, 'object/0/arrow.run', 0, 4, 3);
assert.match(next, /via: \[\{ x: 4, y: 3 \}\]/);
next = addVia(next, 'object/0/arrow.run', 1, 6, 1);
assert.match(next, /via: \[\{ x: 4, y: 3 \}, \{ x: 6, y: 1 \}\]/);
next = moveKnot(next, 'object/0/arrow.run', 'via', 0, 4.5, 3.25);
assert.match(next, /x: 4\.5, y: 3\.25/);
next = moveKnot(next, 'object/0/arrow.run', 'start', 0, 1.5, 2.5);
assert.match(next, /p: \{ x: 1\.5, y: 2\.5 \}/);
next = moveKnot(next, 'object/0/arrow.run', 'end', 0, 8, 1);
assert.match(next, /to: \{ x: 8, y: 1 \}/);
next = removeVia(next, 'object/0/arrow.run', 0);
assert.doesNotMatch(next, /4\.5/);
assert.match(next, /x: 6, y: 1/);
next = removeVia(next, 'object/0/arrow.run', 0);
assert.doesNotMatch(next, /via:/);
assert.equal((parse(next) as { object: { 'arrow.run': { to: { x: number } } }[] }).object[0]['arrow.run'].to.x, 8);

const move = `phases:
  - name: Courbes
    moves:
      - { player: 8, dribble: { x: 18, y: 13, wave: 0.55 } }
      - { from: 6, pass: [21, 4] }
`;
const dribble = addVia(move, 'phases/0/moves/0/dribble', 0, 10, 15);
assert.match(dribble, /dribble: \{ x: 18, y: 13, wave: 0\.55, via: \[\{ x: 10, y: 15 \}\] \}/);
const pass = addVia(move, 'phases/0/moves/1/pass', 0, 21, 7);
assert.match(pass, /pass: \{ x: 21, y: 4, via: \[\{ x: 21, y: 7 \}\] \}/);
const block = `phases:
  - moves:
      - player: 7
        dribble:
          - 8
          - 30
      - player: 11
        run:
          - 60
          - 38
`;
const rewritten = addVia(block, 'phases/0/moves/0/dribble', 0, 12, 27);
assert.match(rewritten, /dribble:\n\s+\{ x: 8, y: 30, via: \[\{ x: 12, y: 27 \}\] \}\n\s+- player: 11/);
assert.equal((parse(rewritten) as { phases: { moves: { dribble: { via: { x: number }[] } }[] }[] }).phases[0].moves[0].dribble.via[0].x, 12);
assert.equal((parse(rewritten) as { phases: { moves: { player?: number }[] }[] }).phases[0].moves[1].player, 11);

const at = dribble.indexOf('wave');
assert.equal(itemAt(dribble, at), 'phases/0/moves/0/dribble');
const onPlayer = dribble.indexOf('player');
assert.equal(itemAt(dribble, onPlayer), 'phases/0/moves/0/dribble');

const tuned = setTravel(dribble, 'phases/0/moves/0/dribble', 'wave', 0.9);
assert.match(tuned, /wave: 0\.9/);
const listed = setTravel(block, 'phases/0/moves/0/dribble', 'amp', 0.4);
assert.match(listed, /dribble:\n\s+\{ x: 8, y: 30, amp: 0\.4 \}\n\s+- player: 11/);
assert.equal((parse(listed) as { phases: { moves: { player?: number }[] }[] }).phases[0].moves[1].player, 11);

const preset = `trajectory:
  motif: sine
  wave: 0.7
  amp: 0.2
`;
const bent = addVia(preset, 'trajectory', 0, 8, 4);
assert.match(bent, /via: \[\{ x: 8, y: 4 \}\]/);
assert.equal(itemAt(bent, bent.indexOf('wave')), 'trajectory');
const longer = setTravel(bent, 'trajectory', 'wave', 1.2);
assert.match(longer, /wave: 1\.2/);
assert.match(longer, /motif: sine/);

console.log('edit arrow ok');
