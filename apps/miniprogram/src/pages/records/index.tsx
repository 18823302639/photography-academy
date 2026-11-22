import {useState} from 'react'
import Taro,{useDidShow} from '@tarojs/taro'
import {View,Button} from '@tarojs/components'
import {taskIds,practiceTasks,type ExerciseId} from '../../../../../packages/photography-core/src/practice-tasks'
import {restoreLoop,loopStorageKey,growthEvidence,type Loop} from '../../../../../packages/photography-core/src/learning-loop'
import {requestExercise,routes,showTab} from '../../navigation'
import {hasDraftContent} from '../index/draft-presentation'
type Item={id:ExerciseId;state:Loop|null;error:boolean}
function read():Item[]{return taskIds.map(id=>{
 try{const raw=Taro.getStorageSync(loopStorageKey(id)),exists=raw!==''&&raw!==null&&raw!==undefined
  const state=exists?restoreLoop(raw,id):null;return {id,state,error:exists&&!state}
 }catch{return {id,state:null,error:true}}
})}
export default function Records(){
 const [items,setItems]=useState(read),[selected,setSelected]=useState<ExerciseId>('single-light-bust-v1'),[status,setStatus]=useState('')
 useDidShow(()=>{showTab('records');setItems(read())})
 const item=items.find(i=>i.id===selected)!,state=item.state
 const activity=items.flatMap(i=>[i.state?.first,i.state?.retake].filter(Boolean).map(r=>({id:i.id,round:r!}))).sort((a,b)=>b.round.savedAt.localeCompare(a.round.savedAt))
 const hasDraft=hasDraftContent(state)
 const stateLabel=item.error?'记录受保护':state?.retake?'两轮与对比已保存':state?.first?'第一轮已保存，可继续复拍':hasDraft?'有未提交草稿':'尚无已保存记录'
 const resumeTitle=item.error?'查看记录状态':state?.retake?'查看两轮记录':state?.first||hasDraft?'继续这项练习':'开始这项练习'
 async function resume(id:ExerciseId){requestExercise(id);try{await Taro.switchTab({url:routes.practice})}catch{setStatus('暂未切换，请点底部「练习」继续。')}}
 return <View className='page'>
  <View className='page-heading'><View className='title'>记录</View><View className='caption'>本机练习档案</View></View>
  <View className='record-count'><View className='count-value'>{activity.length}</View><View><View className='label'>轮已保存</View><View className='caption'>手填观察与 Mock 反馈，尚非实拍质量证明</View></View></View>
  <View className='section'>
   <View className='label'>按练习查看</View>
   <View className='choice-row record-task-select'>{taskIds.map(id=><Button className={id===selected?'selected':'secondary'} key={id} onClick={()=>setSelected(id)}>{practiceTasks[id].title}</Button>)}</View>
  </View>
  <View className='record-summary'>
   <View className='practice-stage'>{stateLabel}</View>
   <View className='task-title'>{practiceTasks[selected].title}</View>
   <View className='summary-intent'>{item.error?'原数据保留，请回练习查看读取提示。':state?.retake?'回看条件差异、反思与保存证据。':state?.first?'下一步：记录复拍，只改一个变量。':hasDraft?'草稿意图：'+(state?.draft.intent||'尚未填写'):practiceTasks[selected].goal}</View>
   <Button className='primary-action' onClick={()=>resume(selected)}>{resumeTitle}</Button>
  </View>
  <View className='section'>
   <View className='label'>最近保存</View>
   {!activity.length?<View><View className='note'>还没有已提交的练习。选择上方练习可查看草稿。</View><Button onClick={()=>resume(selected)}>去练习</Button></View>:
    activity.slice(0,3).map(a=><Button className='list-row' key={a.round.id} onClick={()=>setSelected(a.id)}>{practiceTasks[a.id].title} · {a.round.id.endsWith(':first')?'第一轮':'复拍'}<View className='caption'>{a.round.savedAt}</View></Button>)}
  </View>
  <View className='section record-details'>
   <View className='label'>已存内容与反馈</View>
   <View className='label'>{practiceTasks[selected].title}</View>
   {item.error?<View className='badge'>这项记录暂无法读取，原数据保留。此页不修复或覆盖记录。</View>:
    <View>
     <View className='note'>{stateLabel}</View>
     {state&&<View className='note'>草稿意图：{state.draft.intent||'尚未填写'}；草稿只在练习页编辑。</View>}
     {[state?.first,state?.retake].map((round,i)=>round&&<View className='saved-round' key={round.id}>
      <View className='label'>{i===0?'第一轮':'复拍'} · {round.savedAt}</View>
      <View className='note'>意图：{round.draft.intent}</View><View className='note'>手填条件：{round.draft.conditions}</View><View className='note'>自述观察：{round.draft.observation}</View>
      {i===1&&<View className='note'>对比反思：{round.draft.reflection}</View>}
      <View className='caption'>Mock · {round.review.analysisVersion} · 非照片点评</View>
      <View className='note'>事实：{round.review.fact}</View><View className='note'>推断边界：{round.review.inference}</View>
      {round.review.suggestions.map(s=><View className='note' key={s}>建议：{s}</View>)}
     </View>)}
     {state&&growthEvidence(state).map(e=><View className='caption' key={e.id}>{e.status}：{e.statement} · {e.submissionIds.join(' → ')}</View>)}
    </View>}
  </View>
  <View className='note'>{status}</View><View className='caption'>这里只读原有本机记录，不创建第二份草稿；照片预览不会自动关联这些 Mock 记录。</View>
 </View>
}
