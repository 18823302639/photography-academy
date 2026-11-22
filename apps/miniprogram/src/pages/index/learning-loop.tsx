import {EXERCISE,loopStorageKey} from '../../../../../packages/photography-core/src/learning-loop'
import {practiceTasks,type ExerciseId} from '../../../../../packages/photography-core/src/practice-tasks'
import {useEffect,useRef,useState} from 'react'
import Taro,{useDidHide} from '@tarojs/taro'
import {View,Button,Textarea} from '@tarojs/components'
import type {LightState} from '../../../../../packages/photography-core/src/index'
import {hasDraftContent} from './draft-presentation'
import {newLoop,restoreLoop,persistLoop,submitRound,cancelDraft,compareRounds,growthEvidence,type Loop,type Draft} from '../../../../../packages/photography-core/src/learning-loop'

export type PracticeStage='loading'|'blocked'|'first'|'draft'|'retake'|'done'
export default function LearningLoop({light,exerciseId=EXERCISE,canRecord=true,eligibilityMessage='',active=true,onPhase}:{light:LightState;exerciseId?:ExerciseId;canRecord?:boolean;eligibilityMessage?:string;active?:boolean;onPhase?:(phase:PracticeStage)=>void}){
 const [state,setState]=useState<Loop>(()=>newLoop(exerciseId))
 const current=useRef(state)
 const [ready,setReady]=useState(false)
 const [blocked,setBlocked]=useState(false)
 const [status,setStatus]=useState('正在读取本机闭环记录…')
 const [busy,setBusy]=useState(false)
 const [requirements,setRequirements]=useState(false)
 const [versions,setVersions]=useState(false)
 const lock=useRef(false)
 const mounted=useRef(true)
 const activeRef=useRef(active),operation=useRef(0)
 if(activeRef.current!==active){activeRef.current=active;operation.current++}
 useDidHide(()=>{activeRef.current=false;operation.current++;lock.current=false;setBusy(false)})
 useEffect(()=>{if(!active){lock.current=false;setBusy(false)}},[active])
 const stage:PracticeStage=!ready?'loading':blocked?'blocked':state.retake?'done':state.first?'retake':hasDraftContent(state)?'draft':'first'
 useEffect(()=>{onPhase?.(stage)},[stage,onPhase])
 useEffect(()=>{
  mounted.current=true
  return()=>{mounted.current=false;operation.current++}
 },[])
 function show(next:Loop){current.current=next;setState(next)}
 const write=(key:string,value:Loop)=>Taro.setStorageSync(key,value)
 useEffect(()=>{
  try{
   const raw=Taro.getStorageSync(loopStorageKey(exerciseId))
   if(raw!==''&&raw!==undefined&&raw!==null){
    const restored=restoreLoop(raw,exerciseId)
    if(!restored){setBlocked(true);setStatus('记录版本未知或损坏，已停止写入以保留原数据。');setReady(true);return}
    show(restored);setStatus('已恢复草稿和已提交记录。仅保存在本机。')
   }else setStatus('草稿会自动保存在本机；无照片上传或模型调用。')
  }catch{setBlocked(true);setStatus('读取失败，已停止写入。请重新进入页面重试。')}
  setReady(true)
 },[exerciseId])
 function edit(patch:Partial<Draft>){
  if(!activeRef.current||!ready||!canRecord||blocked||lock.current||current.current.retake)return
  const next={...current.current,draft:{...current.current.draft,...patch}}
  show(next)
  try{persistLoop(next,write);setStatus('草稿已自动保存，可以离开后继续。')}
  catch{setStatus('草稿保存失败：文字仍在当前页面，离开可能丢失。请复制文字或重试保存。')}
 }
 function submit(){
  if(!activeRef.current||!ready||!canRecord||blocked||lock.current)return
  try{
   const round=current.current.first?'retake':'first'
   const next=submitRound(current.current,round,new Date().toISOString())
   persistLoop(next,write);show(next)
   setStatus('本轮已保存；下方是固定规则 Mock 点评，不是照片分析。')
  }catch(e){setStatus(e instanceof Error?e.message:'保存失败，请重试')}
 }
 async function cancel(){
  if(!activeRef.current||lock.current||blocked)return
  const token=++operation.current
  lock.current=true;setBusy(true)
  try{
   const answer=await Taro.showModal({title:'放弃当前草稿？',content:'仅清除尚未提交的意图、条件、观察与模拟快照，保留已提交的两轮记录。'})
   if(!mounted.current||!activeRef.current||operation.current!==token||!answer.confirm)return
   const next=cancelDraft(current.current,true)
   persistLoop(next,write);show(next);setStatus('草稿已清除，已提交证据保留。')
  }catch{if(mounted.current&&operation.current===token)setStatus('取消未完成，草稿保留。')}
  finally{if(operation.current===token){lock.current=false;if(mounted.current)setBusy(false)}}
 }
 const comparison=compareRounds(state)
 const disabled=!active||!ready||!canRecord||blocked||busy
 const task=practiceTasks[exerciseId]
 const original=exerciseId===EXERCISE
 const simulationDiff=comparison?.simulationChanges.map(k=>({angle:'灯位',distance:'灯距',power:'相对输出'}[k])).join('、')||'无'
 return <View className='card learning-sheet'>
  <View className='label'>练习手记</View>
  <View className='caption'>{task.title} · Mock 学习闭环</View>
  <View className='badge'>无照片 / 无真实 AI / EXIF 缺失 / 本机保存</View>
  <View className='note'>目标：{task.goal}</View>
  <Button className='text-action' onClick={()=>setRequirements(v=>!v)}>{requirements?'收起任务要求':'查看任务要求'}</Button>
  <View hidden={!requirements}>
  <View className='note'>起点：{task.start}</View>
  <View className='note'>提交要求：{task.submission}</View>
  <View className='note'>观察标准：{task.observe}</View>
  </View>
  {eligibilityMessage&&<View className='badge'>{eligibilityMessage}</View>}
  <View className='save-status'>{status}</View>
  {ready&&!blocked&&!state.retake&&<View>
   <View className='label'>{state.first?'第二轮：复拍与反思':'第一轮：意图与观察'}</View>
   {([['intent','创作意图（如低调；不是评分目标）'],['conditions','实际条件（手填设备、灯光、机位、曝光；未知写未知）'],['observation','你的观察（手填，未经照片验证）'],...(state.first?[['reflection','对比反思：改变了什么、看到了什么、还有什么不确定']]:[])] as [keyof Omit<Draft,'light'>,string][]).map(([key,label])=><View key={key}>
    <View className='label'>{label}</View>
    <Textarea ariaLabel={label} disabled={disabled} maxlength={500} value={state.draft[key]} onInput={e=>edit({[key]:e.detail.value})}/>
   </View>)}
   {original&&<View className='note'>草稿模拟快照：{state.draft.light.angle}° / {state.draft.light.distance} 米 / {state.draft.light.power}%。不是实拍 EXIF。</View>}
   {original&&<Button disabled={disabled} className='secondary' onClick={()=>edit({light:{...light}})}>记录上方当前模拟参数</Button>}
   <Button disabled={disabled} className='secondary' onClick={()=>edit({})}>重试保存草稿</Button>
   <Button disabled={disabled} onClick={submit}>{state.first?'保存复拍与对比':'保存第一轮并查看 Mock 点评'}</Button>
   <Button disabled={disabled} className='secondary' onClick={cancel}>放弃当前草稿…</Button>
  </View>}
  <View className='rounds'>
  {[state.first,state.retake].map((round,i)=>round&&<View className='round' key={round.id}>
   <View className='label'>{i===0?'第一轮':'复拍'} · 已保存</View>
   <View className='caption'>保存时间：{round.savedAt}</View>
   <View className='note'>意图：{round.draft.intent}</View>
   <View className='note'>手填条件：{round.draft.conditions}</View>
   <View className='note'>手填观察：{round.draft.observation}</View>
   {original&&<View className='note'>模拟快照：{round.draft.light.angle}° / {round.draft.light.distance} 米 / {round.draft.light.power}%</View>}
   {i===1&&<View className='note'>自述反思：{round.draft.reflection}</View>}
   <View className='badge'>Mock 点评 · {round.review.analysisVersion}</View>
   <View className='note'>事实：{round.review.fact}</View>
   <View className='note'>推断边界：{round.review.inference}</View>
   {round.review.suggestions.map(s=><View className='note' key={s}>建议：{s}</View>)}
   <View className='caption' hidden={!versions}>记录：{round.id}；模型：无；提示词：无；schema {round.review.schemaVersion}；标准 {round.review.rubricVersion}。点评关联本轮记录 ID。</View>
  </View>)}
  </View>
  {state.first&&<Button className='text-action' onClick={()=>setVersions(v=>!v)}>{versions?'收起编号与版本':'查看编号与版本'}</Button>}
  {comparison&&<View>
   <View className='label'>条件差异与比较边界</View>
   <View className='note'>意图文字：{comparison.intentChanged?'有变化':'相同'}；条件文字：{comparison.conditionsChanged?'有变化':'相同'}{original?'；模拟变化：'+simulationDiff:''}。</View>
   <View className='note'>{comparison.limitation}</View>
  </View>}
  <View className='label'>成长证据 · 任务 {exerciseId}</View>
  {growthEvidence(state).map(e=><View className='note' key={e.id}>{e.status}：{e.statement} 来源：{e.submissionIds.join(' → ')}</View>)}
  <View className='note'>{state.retake?task.next+' 每个任务分别保存一组两轮记录。':'完成两轮记录后，可以在这里追溯观察与复拍证据。'} 本机数据不会云端备份；清理应用数据可能丢失。</View>
 </View>
}
