
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialLight, relativeIlluminance, lightStops, exposureStops, hemisphereShade, restorePractice} from '../src/index.ts';
test('inverse square: double distance means quarter light / minus two stops',()=>{
 assert.equal(relativeIlluminance({...initialLight,distance:2}),.25);
 assert.equal(lightStops({...initialLight,distance:2}),-2);
});
test('power half means one stop; ISO changes signal exposure index not incident light',()=>{
 assert.equal(lightStops({...initialLight,power:50}),-1);
 assert.equal(exposureStops(4,1/125,200),1);
 assert.equal(exposureStops(4,1/250,100),-1);
 assert.ok(Math.abs(exposureStops(4*Math.SQRT2,1/125,100)+1)<1e-10);
});
test('opposite light mirrors illustrative shading',()=>{
 assert.ok(hemisphereShade(.6,0,initialLight)>hemisphereShade(-.6,0,initialLight));
 assert.equal(hemisphereShade(.6,0,initialLight),hemisphereShade(-.6,0,{...initialLight,angle:-45}));
});
test('reject non-finite and zero input',()=>{
 for(const distance of [0,NaN,Infinity,4]) assert.throws(()=>relativeIlluminance({...initialLight,distance}));
 assert.throws(()=>exposureStops(0,1,100));
});
test('local saved state roundtrips, corruption and outdated versions rejected',()=>{
 const r={version:1,light:initialLight,observation:'观察阴影',savedAt:'2026-11-14T00:00:00Z'};
 assert.deepEqual(restorePractice(r),r);
 for(const x of [null,{}, {...r,version:2},{...r,light:{...initialLight,power:0}},{...r,observation:'a'.repeat(501)}]) assert.equal(restorePractice(x),null);
});
