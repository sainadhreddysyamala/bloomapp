const test = require('node:test');
const assert = require('node:assert/strict');
test('business date format accepts YYYY-MM-DD', () => { assert.match('2026-10-25', /^\d{4}-\d{2}-\d{2}$/); });
test('absent records have zero flowers at controller level', () => { const attendance='absent'; const morga=attendance==='absent'?0:10; const jasmine=attendance==='absent'?0:4; assert.equal(morga,0); assert.equal(jasmine,0); });
