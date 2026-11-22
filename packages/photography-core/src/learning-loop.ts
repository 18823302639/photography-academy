import {isExerciseId,practiceTasks,type ExerciseId} from './practice-tasks.ts'
import {initialLight, validateLight, type LightState} from './index.ts'

export const LOOP_KEY='photography-academy:learning-loop:v1'
export const EXERCISE='single-light-bust-v1'
export type Draft={intent:string; conditions:string; observation:string; reflection:string; light:LightState}
export type Review={kind:'mock'; model:'none'; promptVersion:'none'; schemaVersion:'1'; rubricVersion:'single-light-v1'|'exposure-compensation-v1'|'shutter-motion-v1'; analysisVersion:'mock-loop-v1'|'mock-task-v1'; submissionId:string; fact:string; inference:string; suggestions:string[]}
export type Submission={id:string; exerciseId:ExerciseId; source:'user_report'; exifSource:'missing'; photoId:null; savedAt:string; draft:Draft; review:Review}
export type Loop={version:1; exerciseId:ExerciseId; draft:Draft; first:Submission|null; retake:Submission|null}
export const blankDraft=():Draft=>({intent:'',conditions:'',observation:'',reflection:'',light:{...initialLight}})
export const newLoop=(exerciseId:ExerciseId=EXERCISE):Loop=>({version:1,exerciseId,draft:blankDraft(),first:null,retake:null})
export function loopStorageKey(exerciseId:ExerciseId):string{
 if(!isExerciseId(exerciseId))throw Error('未知任务')
 return exerciseId===EXERCISE?LOOP_KEY:LOOP_KEY+':'+exerciseId
}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
function validDraft(d:Draft,submitted=false,retake=false){
 if(!d || typeof d!=='object')throw Error('草稿损坏')
 for(const key of ['intent','conditions','observation','reflection'] as const){
  if(typeof d[key]!=='string'||d[key].length>500)throw Error('文字最多 500 字')
 }
 validateLight(d.light)
 if(submitted && (!d.intent.trim()||!d.conditions.trim()||!d.observation.trim()||(retake&&!d.reflection.trim())))
  throw Error('请填写意图、实际条件、观察；复拍还需填写对比反思。')
}
export function mockReview(id:string,exerciseId:ExerciseId=EXERCISE):Review{
 if(exerciseId!==EXERCISE)return {kind:'mock',model:'none',promptVersion:'none',schemaVersion:'1',rubricVersion:exerciseId,analysisVersion:'mock-task-v1',submissionId:id,
 fact:'仅保存了手填意图、条件、观察与反思。没有照片，EXIF 缺失，不能核实是否实拍或判断画面。',
 inference:'未进行视觉推断；任务记录不证明真实画质或技能提升，低调或运动模糊意图不自动视为失败。',suggestions:[...practiceTasks[exerciseId].suggestions]}
 return {kind:'mock',model:'none',promptVersion:'none',schemaVersion:'1',rubricVersion:'single-light-v1',analysisVersion:'mock-loop-v1',submissionId:id,
 fact:'仅保存了手填意图、条件和观察，以及模拟参数快照。没有照片，EXIF 缺失；无法验证实际曝光或画面。',
 inference:'未进行视觉推断。低调意图允许较大暗部，不能仅凭暗就判失败；手填观察尚未独立验证。',
 suggestions:['固定机位、构图与曝光，只改变一个灯光变量。','复拍后记录鼻影、明暗交界及背景变化，并列出其他条件差异。']}
}
export function submitRound(state:Loop,round:'first'|'retake',now:string):Loop{
 // A completed slot is immutable: repeated taps never create or overwrite evidence.
 if(state[round])return state
 if(round==='retake'&&!state.first)throw Error('请先记录第一轮')
 validDraft(state.draft,true,round==='retake')
 if(!Number.isFinite(Date.parse(now)))throw Error('时间无效')
 const next=copy(state),id=state.exerciseId+':'+round
 next[round]={id,exerciseId:state.exerciseId,source:'user_report',exifSource:'missing',photoId:null,savedAt:now,draft:copy(state.draft),review:mockReview(id,state.exerciseId)}
 next.draft=blankDraft()
 return next
}
export function cancelDraft(state:Loop,confirmed:boolean):Loop{
 return confirmed?{...state,draft:blankDraft()}:state
}
// JSON object member order is not part of the review contract.
function matchesMockReview(raw:unknown,expected:Review):boolean{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false
 const actual=raw as Record<string,unknown>
 const fields=Object.entries(expected)
 return Object.keys(actual).length===fields.length && fields.every(([key,value])=>{
  if(!Object.prototype.hasOwnProperty.call(actual,key))return false
  const candidate=actual[key]
  return Array.isArray(value)
   ? Array.isArray(candidate)&&candidate.length===value.length&&value.every((item,i)=>candidate[i]===item)
   : candidate===value
 })
}
export function restoreLoop(raw:unknown,expectedExercise:ExerciseId=EXERCISE):Loop|null{
 try{
  const s=raw as Loop
  if(!s||s.version!==1||!isExerciseId(s.exerciseId)||s.exerciseId!==expectedExercise) return null
  validDraft(s.draft)
  for(const round of ['first','retake'] as const){
   const r=s[round]
   if(r===null)continue
   if(!r||r.id!==s.exerciseId+':'+round||r.exerciseId!==s.exerciseId||r.source!=='user_report'||r.exifSource!=='missing'||r.photoId!==null||
    typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt)))return null
   validDraft(r.draft,true,round==='retake')
   if(!matchesMockReview(r.review,mockReview(r.id,s.exerciseId)))return null
  }
  if(s.retake&&!s.first)return null
  return copy(s)
 }catch{return null}
}
export function persistLoop(next:Loop,write:(key:string,value:Loop)=>void):Loop{
 if(!restoreLoop(next,next.exerciseId))throw Error('记录结构无效，未保存')
 write(loopStorageKey(next.exerciseId),copy(next))
 return next
}
export function compareRounds(state:Loop){
 if(!state.first||!state.retake)return null
 const a=state.first.draft,b=state.retake.draft
 return {simulationChanges:(['angle','distance','power'] as const).filter(k=>a.light[k]!==b.light[k]),
  intentChanged:a.intent!==b.intent,conditionsChanged:a.conditions!==b.conditions,
  limitation:'文字相同也不证明实际条件相同；模拟参数不代表实拍测量。此对比不能证明画质或能力提升。'}
}
export function growthEvidence(state:Loop){
 if(!state.first)return []
 return [{id:state.exerciseId+':attempt',exerciseId:state.exerciseId,submissionIds:[state.first.id],status:'已尝试',statement:'已保存一轮手填观察，尚无实拍验证。'},
 ...(state.retake?[{id:state.exerciseId+':comparison',exerciseId:state.exerciseId,submissionIds:[state.first.id,state.retake.id],status:'已记录复拍对比',statement:'已保存两轮条件与自述反思；不等于掌握证据或 AI 质量验收。'}]:[])]
}
