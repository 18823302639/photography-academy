import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultProfile,restoreProfile,selectDevice,capabilities,practicePlan,exposureComparison,examples,BASE,evaluateCompensation} from '../src/exposure-lesson.ts'
test('unconfirmed phone never receives aperture or manual exposure assignment',()=>{
 const p={...defaultProfile(),lamp:'ml100' as const}
 const c=capabilities(p),plan=practicePlan(p)
 assert.equal(c.aperture,false);assert.equal(c.shutter,false);assert.equal(c.iso,false)
 assert.equal(plan.mode,'practice');assert.match(plan.steps[0],/只比较阴影形状/)
 assert.match(plan.limitation,/不能把亮度变化归因/)
})
test('confirmed phone controls and exposure lock produce distinct actionable routes',()=>{
 const p={...defaultProfile(),lamp:'likai40' as const,lockConfirmed:true}
 assert.match(practicePlan(p).steps[0],/曝光锁定/)
 const manual={...p,manualConfirmed:true}
 assert.match(practicePlan(manual).steps[0],/关闭自动 ISO/)
 assert.equal(capabilities(manual).aperture,false)
})
test('changing devices resets capability assumptions and profiles roundtrip',()=>{
 const p={...defaultProfile(),device:'r7' as const,manualConfirmed:true,apertureConfirmed:true,lockConfirmed:true,lamp:'ml100' as const}
 assert.deepEqual(restoreProfile(JSON.parse(JSON.stringify(p))),p)
 const phone=selectDevice(p,'phone')
 assert.equal(phone.lamp,'ml100')
 assert.equal(capabilities(phone).aperture,false);assert.equal(capabilities(phone).shutter,false)
 assert.equal(phone.lockConfirmed,false)
 assert.equal(capabilities(p).aperture,true)
})
test('unknown versions, wrong types and unsupported phone aperture are rejected',()=>{
 const p=defaultProfile()
 for(const v of [null,{}, {...p,version:2},{...p,manualConfirmed:'yes'},{...p,device:'unknown'},{...p,lamp:'unknown'},{...p,apertureConfirmed:true}])
  assert.equal(restoreProfile(v),null)
})
test('no continuous light and flash are simulation only; each continuous lamp allows observation',()=>{
 for(const lamp of ['none','v1'] as const)assert.equal(practicePlan({...defaultProfile(),lamp}).mode,'simulation')
 assert.match(practicePlan({...defaultProfile(),lamp:'v1'}).limitation,/不能.*闪光曝光/)
 for(const lamp of ['ml100','likai40','other'] as const)assert.equal(practicePlan({...defaultProfile(),lamp}).mode,'practice')
})
test('lesson stop examples separate physical exposure from ISO and preserve compensation',()=>{
 const result=examples.map(e=>exposureComparison(e.value))
 assert.deepEqual(result[0],{lightStops:0,isoStops:0,equivalentStops:0})
 assert.equal(result[1].lightStops,-1);assert.equal(result[1].equivalentStops,-1)
 assert.equal(result[2].lightStops,-1);assert.equal(result[2].isoStops,1);assert.equal(result[2].equivalentStops,0)
 assert.equal(result[3].lightStops,-2);assert.equal(result[4].lightStops,0)
 assert.equal(exposureComparison({...BASE,seconds:1/62.5}).lightStops,1)
 assert.throws(()=>exposureComparison({...BASE,iso:0}))
 assert.throws(()=>exposureComparison({...BASE,seconds:NaN}))
})

test('ISO compensation exercise rewards equivalent index but preserves one-stop physical light loss',()=>{
 for(const [choice,expected,stops] of [['iso-100',false,-1],['iso-200',true,0],['iso-400',false,1]] as const){
  const r=evaluateCompensation('iso-compensation',choice)
  assert.equal(r.correct,expected);assert.equal(r.comparison.equivalentStops,stops)
  assert.equal(r.comparison.lightStops,-1);assert.match(r.explanation,/没有补回光子/)
 }
})
test('time compensation exercise restores physical exposure only with four times the duration',()=>{
 const correct=evaluateCompensation('time-compensation','time-31')
 assert.equal(correct.correct,true);assert.equal(correct.comparison.lightStops,0);assert.equal(correct.comparison.isoStops,0)
 for(const [choice,light] of [['time-500',-4],['time-125',-2]] as const){
  const r=evaluateCompensation('time-compensation',choice);assert.equal(r.correct,false);assert.equal(r.comparison.lightStops,light)
 }
})
test('exercise evaluation rejects unknown exercises and choices from another question',()=>{
 assert.throws(()=>evaluateCompensation('unknown','iso-200'),/未知/)
 assert.throws(()=>evaluateCompensation('iso-compensation','time-31'),/不属于/)
 assert.throws(()=>evaluateCompensation('time-compensation','unknown'),/不属于/)
})
