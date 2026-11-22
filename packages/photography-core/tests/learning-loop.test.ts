import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newLoop,restoreLoop,submitRound,cancelDraft,persistLoop,compareRounds,growthEvidence,LOOP_KEY,type Loop} from '../src/learning-loop.ts'
const now='2026-11-14T18:00:00Z'
function filled(){const s=newLoop();s.draft={...s.draft,intent:'低调',conditions:'R7，曝光未知，机位手填',observation:'自述鼻影变长'};return s}
test('draft and both rounds recover across interruption with traceable mock evidence',()=>{
 let disk:unknown
 const write=(key:string,s:Loop)=>{assert.equal(key,LOOP_KEY);disk=JSON.parse(JSON.stringify(s))}
 persistLoop(filled(),write)
 let s=restoreLoop(disk)!
 assert.equal(s.draft.intent,'低调')
 s=persistLoop(submitRound(s,'first',now),write)
 s=restoreLoop(disk)!
 assert.equal(s.first!.exifSource,'missing');assert.equal(s.first!.photoId,null)
 assert.equal(s.first!.review.model,'none');assert.equal(s.first!.review.submissionId,s.first!.id)
 s.draft={...filled().draft,reflection:'背景变化尚不确定',light:{angle:45,distance:2,power:100}}
 persistLoop(s,write);s=restoreLoop(disk)!
 s=persistLoop(submitRound(s,'retake',now),write)
 const restored=restoreLoop(disk)!
 assert.deepEqual(restored,s)
 assert.deepEqual(compareRounds(s)!.simulationChanges,['distance'])
 assert.equal(growthEvidence(s).length,2)
 assert.deepEqual(growthEvidence(s)[1].submissionIds,[s.first!.id,s.retake!.id])
})
test('completed slots are immutable and duplicate submission is idempotent',()=>{
 let s=submitRound(filled(),'first',now)
 const snapshot=JSON.stringify(s.first)
 s.draft={...filled().draft,reflection:'仅自述变化'}
 s=submitRound(s,'retake',now)
 assert.equal(submitRound(s,'retake','invalid'),s)
 assert.equal(submitRound(s,'first',now),s)
 assert.equal(JSON.stringify(s.first),snapshot)
 assert.equal(growthEvidence(s).length,2)
})
test('cancel refusal is a no-op; confirmation preserves submitted evidence',()=>{
 const s=submitRound(filled(),'first',now);s.draft={...filled().draft}
 assert.equal(cancelDraft(s,false),s)
 const cancelled=cancelDraft(s,true)
 assert.deepEqual(cancelled.first,s.first)
 assert.equal(cancelled.draft.observation,'')
 assert.equal(s.draft.observation,'自述鼻影变长')
})
test('failed storage commit leaves prior durable evidence and retry succeeds once',()=>{
 let disk:Loop=filled()
 const before=JSON.stringify(disk)
 const next=submitRound(disk,'first',now)
 assert.throws(()=>persistLoop(next,()=>{throw Error('quota')}),/quota/)
 assert.equal(JSON.stringify(disk),before)
 assert.equal(disk.first,null)
 persistLoop(next,(_,s)=>{disk=s})
 assert.equal(growthEvidence(restoreLoop(disk)!).length,1)
 assert.equal(submitRound(disk,'first',now),disk)
})
test('invalid sequencing, missing intent/conditions/observation/reflection are rejected',()=>{
 assert.throws(()=>submitRound(filled(),'retake',now))
 for(const key of ['intent','conditions','observation'] as const){
  const s=filled();s.draft[key]='  ';assert.throws(()=>submitRound(s,'first',now))
 }
 const s=submitRound(filled(),'first',now);s.draft={...filled().draft}
 assert.throws(()=>submitRound(s,'retake',now))
 assert.throws(()=>submitRound(filled(),'first','invalid'))
})
test('corrupt, future, forged real-analysis and orphaned records are rejected',()=>{
 const s=submitRound(filled(),'first',now)
 const variants:any[]=[null,{}, {...s,version:2},{...s,draft:{...s.draft,light:{angle:0,distance:0,power:100}}},
 {...s,draft:{...s.draft,intent:'x'.repeat(501)}},
 {...s,first:{...s.first,exifSource:'exif'}},
 {...s,first:{...s.first,review:{...s.first!.review,model:'real'}}},
 {...s,first:{...s.first,id:'other-task:first'}}]
 s.draft={...filled().draft,reflection:'未验证'}
 variants.push({...submitRound(s,'retake',now),first:null})
 for(const value of variants)assert.equal(restoreLoop(value),null)
})
test('comparison describes differences without claiming equal actual conditions or improvement',()=>{
 let s=submitRound(filled(),'first',now)
 s.draft={...filled().draft,intent:'自然',conditions:'设备未知',reflection:'无法判断改善',light:{angle:-45,distance:1,power:50}}
 s=submitRound(s,'retake',now)
 const c=compareRounds(s)!
 assert.equal(c.intentChanged,true);assert.equal(c.conditionsChanged,true)
 assert.deepEqual(c.simulationChanges,['angle','power'])
 assert.match(c.limitation,/不能证明/)
 assert.ok(s.first!.review.suggestions.length<=3)
 assert.match(s.first!.review.inference,/低调/)
})
test('stored objects and snapshots do not alias editable drafts',()=>{
 const draft=filled(),s=submitRound(draft,'first',now)
 draft.draft.observation='changed'
 assert.equal(s.first!.draft.observation,'自述鼻影变长')
 let disk:Loop=newLoop();persistLoop(s,(_,v)=>{disk=v})
 s.first!.draft.observation='mutated memory'
 assert.equal(disk.first!.draft.observation,'自述鼻影变长')
 const recovered=restoreLoop(disk)!;recovered.first!.draft.observation='mutated restored'
 assert.equal(disk.first!.draft.observation,'自述鼻影变长')
})

test('review JSON member order does not invalidate an otherwise identical saved round',()=>{
 const s=submitRound(filled(),'first',now)
 const reordered=Object.fromEntries(Object.entries(s.first!.review).reverse())
 const raw=JSON.parse(JSON.stringify({...s,first:{...s.first,review:reordered}}))
 assert.ok(restoreLoop(raw),'valid review with reordered JSON members must recover')
 assert.deepEqual(restoreLoop(raw)!.first!.review,s.first!.review)
})
test('semantic review verification still rejects changed, missing, extra fields and reordered advice',()=>{
 const s=submitRound(filled(),'first',now),r=s.first!.review
 const {rubricVersion,...missing}=r
 const bad=[{...r,analysisVersion:'future'}, {...r,fact:'伪造照片分析'},missing,{...r,extra:'unexpected'},
  {...r,suggestions:[...r.suggestions].reverse()},{...r,suggestions:[r.suggestions[0]]},
  {...r,suggestions:[...r.suggestions,'额外建议']},null,[],{...r,kind:'real'}]
 for(const review of bad)assert.equal(restoreLoop({...s,first:{...s.first,review}}),null)
})
test('both reordered round reviews remain usable for further draft persistence without rewriting history',()=>{
 let s=submitRound(filled(),'first',now)
 s.draft={...filled().draft,reflection:'条件仍不完全可比'}
 s=submitRound(s,'retake',now)
 const raw=JSON.parse(JSON.stringify(s))
 for(const k of ['first','retake'])raw[k].review=Object.fromEntries(Object.entries(raw[k].review).reverse())
 const before=JSON.stringify(raw),restored=restoreLoop(raw)
 assert.ok(restored)
 let saved:unknown
 persistLoop(restored,(_,value)=>{saved=value})
 assert.equal(growthEvidence(restoreLoop(saved)!).length,2)
 assert.equal(JSON.stringify(raw),before)
 assert.deepEqual(restored.first!.draft,s.first!.draft)
 assert.deepEqual(restored.retake!.draft,s.retake!.draft)
})
