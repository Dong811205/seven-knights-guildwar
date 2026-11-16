import test from 'node:test';
import assert from 'node:assert/strict';
import {warClockState} from '../war-clock.mjs';
test('Taiwan clock counts down to 01:00 across midnight and alerts for final 30 minutes',()=>{
 assert.deepEqual(warClockState(new Date('2026-11-16T16:00:00Z')),{current:'00:00:00',remaining:'01:00:00',urgent:false});
 assert.deepEqual(warClockState(new Date('2026-11-16T16:30:00Z')),{current:'00:30:00',remaining:'00:30:00',urgent:true});
 assert.deepEqual(warClockState(new Date('2026-11-16T16:59:59Z')),{current:'00:59:59',remaining:'00:00:01',urgent:true});
 assert.deepEqual(warClockState(new Date('2026-11-16T17:00:00Z')),{current:'01:00:00',remaining:'24:00:00',urgent:false});
 assert.deepEqual(warClockState(new Date('2026-11-16T15:59:59Z')),{current:'23:59:59',remaining:'01:00:01',urgent:false});
});
