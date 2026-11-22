import {test} from 'node:test'
import assert from 'node:assert/strict'
import {motionDistance,motionShutters,motionSpeeds} from '../src/motion.ts'
test('constant-speed exposure trajectory scales with shutter duration',()=>{
 assert.equal(motionDistance(1/125,2000),16)
 assert.equal(motionDistance(1/250,2000),8)
 assert.equal(motionDistance(1/500,2000),4)
 assert.equal(motionDistance(1/62.5,2000),32)
})
test('speed changes and static subjects obey the same model; presets remain within the diagram',()=>{
 assert.equal(motionDistance(1/125,1000)*2,motionDistance(1/125,2000))
 assert.equal(motionDistance(1/125,0),0)
 for(const shutter of motionShutters)for(const speed of motionSpeeds){
  const distance=motionDistance(shutter.seconds,speed.unitsPerSecond)
  assert.ok(distance>=0&&10+distance<100)
 }
})
test('invalid, negative and unrepresentable motion inputs are rejected',()=>{
 for(const s of [0,-1,NaN,Infinity])assert.throws(()=>motionDistance(s,1000),RangeError)
 for(const v of [-1,NaN,Infinity])assert.throws(()=>motionDistance(1/125,v),RangeError)
 assert.throws(()=>motionDistance(Number.MAX_VALUE,2),RangeError)
})
