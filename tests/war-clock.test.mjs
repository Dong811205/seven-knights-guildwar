import test from 'node:test';
import assert from 'node:assert/strict';
import {warClockState} from '../war-clock.mjs';
const at=time=>warClockState(new Date(time+'+08:00'));
test('Mon Wed Sat attack windows start 08:00 and continue across midnight until 01:00',()=>{
 for(const day of ['2026-11-16','2026-11-18','2026-11-21']){
  const s=at(day+'T08:00:00');assert.equal(s.kind,'attack');assert.equal(s.active,true);assert.equal(s.remaining,'17:00:00');assert.match(s.label,/提醒出刀/);
 }
 const s=at('2026-11-17T00:30:00');assert.equal(s.active,true);assert.equal(s.kind,'attack');assert.equal(s.remaining,'00:30:00');assert.equal(s.urgent,true);
 assert.equal(at('2026-11-17T00:29:59').urgent,false);
 assert.equal(at('2026-11-17T00:59:59').remaining,'00:00:01');
});
test('Tue Fri Sun defense windows run 08:00–19:00, with final 30 minute warning',()=>{
 for(const day of ['2026-11-17','2026-11-20','2026-11-22']){
  const s=at(day+'T08:00:00');assert.equal(s.kind,'defense');assert.equal(s.active,true);assert.equal(s.remaining,'11:00:00');assert.match(s.label,/更新防守隊伍/);
  assert.equal(at(day+'T18:29:59').urgent,false);assert.equal(at(day+'T18:30:00').urgent,true);assert.equal(at(day+'T18:59:59').remaining,'00:00:01');assert.equal(at(day+'T19:00:00').active,false);
 }
});
test('outside activity hours count down to next start without a closing warning',()=>{
 const after=at('2026-11-17T01:00:00');assert.equal(after.active,false);assert.equal(after.kind,'defense');assert.equal(after.remaining,'07:00:00');assert.equal(after.urgent,false);
 const before=at('2026-11-16T07:59:59');assert.equal(before.remaining,'00:00:01');assert.equal(before.active,false);assert.equal(before.urgent,false);
 const thursday=at('2026-11-19T12:00:00');assert.equal(thursday.kind,'defense');assert.equal(thursday.remaining,'20:00:00');assert.match(thursday.label,/週五 08:00/);
 const sunday=at('2026-11-22T19:00:00');assert.equal(sunday.kind,'attack');assert.equal(sunday.remaining,'13:00:00');assert.match(sunday.label,/週一/);
});
