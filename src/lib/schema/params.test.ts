import assert from 'node:assert/strict';
import { applyParams, hexForInput, isColorValue, paramsOf } from './params';

const markup = '<circle fill="{{fill|#2563eb}}"/><text fill="{{ink|#fff}}">{{name|8}}</text>';
const params = paramsOf(markup);
assert.deepEqual(params.map(item => item.name), ['fill', 'ink', 'name']);
assert.equal(params[0].fallback, '#2563eb');
assert.equal(params[2].fallback, '8');

assert.equal(applyParams(markup, {}), '<circle fill="#2563eb"/><text fill="#fff">8</text>');
assert.equal(applyParams(markup, { name: '10', fill: '#dc2626' }), '<circle fill="#dc2626"/><text fill="#fff">10</text>');
assert.equal(applyParams('{{title}}', { title: 'A & B' }), 'A &amp; B');
assert.equal(applyParams('{{title|zone}}', {}), 'zone');

assert.equal(isColorValue('#2563eb'), true);
assert.equal(isColorValue('8'), false);
assert.equal(hexForInput('#abc'), '#aabbcc');
assert.equal(hexForInput('#2563eb'), '#2563eb');

console.log('params ok');
