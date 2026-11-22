import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {taskIds,practiceTasks,taskEligibility} from '../src/practice-tasks.ts'
import {defaultProfile} from '../src/exposure-lesson.ts'
import {newLoop,submitRound,restoreLoop,persistLoop,loopStorageKey,LOOP_KEY,EXERCISE,growthEvidence} from '../src/learning-loop.ts'
const now='2026-11-14T00:00:00Z'
test('three planned task types each have goals, starts, submissions and observation criteria',()=>{
 assert.equal(taskIds.length,3)
 for(const id of taskIds){
  const t=practiceTasks[id]
  for(const field of ['goal','start','submission','observe'] as const)assert.ok(t[field].length>10)
  assert.ok(t.suggestions.length<=3)
 }
})
test('new physical task controls are capability-gated without assuming phone aperture',()=>{
 const p=defaultProfile()
 assert.equal(taskEligibility(EXERCISE,p).allowed,true)
 for(const id of ['exposure-compensation-v1','shutter-motion-v1'] as const){
  assert.equal(taskEligibility(id,p).allowed,false)
  assert.equal(taskEligibility(id,{...p,lamp:'ml100'}).allowed,false)
  for(const lamp of ['none','v1','other'] as const)assert.equal(taskEligibility(id,{...p,manualConfirmed:true,lamp}).allowed,false)
  for(const device of ['phone','r7'] as const)for(const lamp of ['ml100','likai40'] as const)
   assert.equal(taskEligibility(id,{...p,device,manualConfirmed:true,lamp}).allowed,true)
 }
})
test('three task storage keys, submission IDs, mock standards and evidence stay isolated',()=>{
 const disk=new Map()
 for(const id of taskIds){
  let s=newLoop(id);s.draft={...s.draft,intent:'合成自述，非实拍验证',conditions:'未知曝光',observation:id}
  s=submitRound(s,'first',now)
  persistLoop(s,(key,value)=>disk.set(key,value))
  assert.equal(s.first!.id,id+':first');assert.equal(s.first!.exerciseId,id)
  assert.equal(s.first!.review.kind,'mock');assert.equal(s.first!.photoId,null)
  assert.equal(s.first!.review.rubricVersion,id===EXERCISE?'single-light-v1':id)
  assert.equal(growthEvidence(s)[0].exerciseId,id)
 }
 assert.equal(loopStorageKey(EXERCISE),LOOP_KEY);assert.equal(disk.size,3)
 for(const id of taskIds){
  const saved=disk.get(loopStorageKey(id))
  assert.ok(restoreLoop(saved,id))
  for(const other of taskIds)if(other!==id)assert.equal(restoreLoop(saved,other),null)
 }
})
test('real r1-produced synthetic legacy record restores byte-equivalent data without migration',()=>{
 const raw=JSON.parse(readFileSync(new URL('../../../tests/fixtures/legacy-loop-v1.json',import.meta.url),'utf8'))
 const before=JSON.stringify(raw),restored=restoreLoop(raw)
 assert.ok(restored);assert.equal(JSON.stringify(restored),before)
 let key='',value:unknown
 persistLoop(restored,(k,v)=>{key=k;value=v})
 assert.equal(key,LOOP_KEY);assert.equal(JSON.stringify(value),before)
})
test('cross-task identity and review substitution are rejected',()=>{
 const id='exposure-compensation-v1'
 let s=newLoop(id);s.draft={...s.draft,intent:'自述',conditions:'未知',observation:'未知'}
 s=submitRound(s,'first',now)
 assert.equal(restoreLoop({...s,first:{...s.first,exerciseId:EXERCISE}},id),null)
 assert.equal(restoreLoop({...s,first:{...s.first,id:EXERCISE+':first'}},id),null)
 const legacy=JSON.parse(readFileSync(new URL('../../../tests/fixtures/legacy-loop-v1.json',import.meta.url),'utf8'))
 assert.equal(restoreLoop({...s,first:{...s.first,review:legacy.first.review}},id),null)
})
