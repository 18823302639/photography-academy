import {taskEligibility,practiceTasks,type ExerciseId} from '../../../../../packages/photography-core/src/practice-tasks'
import ExposureLesson from './exposure-lesson'
import {practicePlan, defaultProfile} from '../../../../../packages/photography-core/src/exposure-lesson'
import LearningLoop,{type PracticeStage} from './learning-loop'
import PracticeTasks from './practice-tasks'
import {showTab,consumeExercise,currentTab} from '../../navigation'

import { useEffect, useRef, useState } from 'react'
import Taro, {useReady,useDidShow,useDidHide} from '@tarojs/taro'
import {View, Text, Canvas, Slider, Button, Textarea} from '@tarojs/components'
import {initialLight, hemisphereShade, lightStops, restorePractice, type LightState} from '../../../../../packages/photography-core/src/index'
import fixture from '../../../../../packages/contracts/practice.fixture.json'

const KEY='photography-academy:single-light:v1'
export default function Index() {
 const [panel,setPanel]=useState<'record'|'setup'|'light'>('record')
 const [visible,setVisible]=useState(true)
 const [phase,setPhase]=useState<PracticeStage>('loading')
 const [sampleOpen,setSampleOpen]=useState(false)
 const clearEpoch=useRef(0)
 const [activeTask,setActiveTask]=useState<ExerciseId>('single-light-bust-v1')
 const [profile,setProfile]=useState(defaultProfile)
 const [plan,setPlan]=useState(()=>practicePlan(defaultProfile()))
 const [navigationStatus,setNavigationStatus]=useState('')
 const [light,setLight]=useState<LightState>({...initialLight})
 const [observation,setObservation]=useState('')
 const [status,setStatus]=useState('尚未保存。记录只存在本机，不会上传。')
 const [canvasError,setCanvasError]=useState('')
 const [canvasVersion,setCanvasVersion]=useState(0)
 const [canvasHeight,setCanvasHeight]=useState(220)
 const canvas=useRef<any>(null)
 const alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearEpoch.current++}},[])
 useDidShow(()=>{showTab('practice');setVisible(true);const id=consumeExercise();if(id){setActiveTask(id);setPanel('record')}})
 useDidHide(()=>{setVisible(false);clearEpoch.current++})
 useEffect(()=>{if(panel!=='light')clearEpoch.current++},[panel])
 useReady(()=>{
  try {
   const raw=Taro.getStorageSync(KEY)
   const saved=restorePractice(raw)
   if(saved){setLight(saved.light);setObservation(saved.observation);setStatus('已恢复上次本机练习。')}
   else if(raw) setStatus('旧记录无法读取，已使用初始参数；保存新记录前不会覆盖。')
  } catch {setStatus('无法读取本机记录，仍可练习。')}
 })
 useEffect(()=>{
  if(panel!=='light'||!visible)return
  Taro.nextTick(()=>{
   if(!alive.current||currentTab()!=='practice')return
   Taro.createSelectorQuery().select('#light-canvas').fields({node:true,size:true}).exec(result=>{
   if(!alive.current||currentTab()!=='practice')return
   const entry=result?.[0]
   if(!entry?.node){setCanvasError('Canvas 2D 不可用，请在微信开发者工具或真机重试。');return}
   if(entry.width>0)setCanvasHeight(entry.width*220/280)
   canvas.current=entry.node
   canvas.current.width=280; canvas.current.height=220
   setCanvasError('');setCanvasVersion(v=>v+1)
   })
 })
 },[panel,visible])
 useEffect(()=>{
  if(!canvasVersion || !canvas.current)return
  try {
   const ctx=canvas.current.getContext('2d')
   ctx.fillStyle='#14201c';ctx.fillRect(0,0,280,220)
   const image=ctx.createImageData(160,160)
   for(let y=0;y<160;y++)for(let x=0;x<160;x++){
    const nx=(x-79.5)/78,ny=(y-79.5)/78,i=(y*160+x)*4
    if(nx*nx+ny*ny>1)continue
    const v=Math.round(255*Math.pow(hemisphereShade(nx,ny,light),1/2.2))
    image.data[i]=v;image.data[i+1]=v;image.data[i+2]=Math.round(v*.94);image.data[i+3]=255
   }
   ctx.putImageData(image,60,20)
   ctx.fillStyle='#e8d59e';ctx.beginPath();ctx.arc(140+Math.sin(light.angle*Math.PI/180)*110,196,6,0,Math.PI*2);ctx.fill()
   ctx.font='12px sans-serif';ctx.fillStyle='#fff';ctx.fillText('单灯 · 球面示意（非实拍预测）',55,214)
  } catch {setCanvasError('绘图失败，参数与练习仍可使用。')}
 },[canvasVersion,light])
 function save(){
  try {Taro.setStorageSync(KEY,{version:1,light,observation,savedAt:new Date().toISOString()});setStatus('已保存本机参数和观察记录。没有提交照片或调用 AI。')}
  catch {setStatus('保存失败，请先复制观察文字，稍后重试。')}
 }
 async function clear(){
  const token=++clearEpoch.current
  let answer
  try{answer=await Taro.showModal({title:'清除本机练习？',content:'将清除本页参数及观察文字，不影响其他内容。'})}
  catch{if(alive.current&&token===clearEpoch.current)setStatus('取消未完成，本机记录保留。');return}
  if(!alive.current||token!==clearEpoch.current||currentTab()!=='practice'||!answer.confirm)return
  try {Taro.removeStorageSync(KEY);setLight({...initialLight});setObservation('');setStatus('本机记录已清除。')}
  catch {setStatus('清除失败，记录可能仍存在。')}
 }
 function recordEntry(id:ExerciseId=activeTask){
  setActiveTask(id);setPanel('record')
  Taro.nextTick(()=>Taro.pageScrollTo({selector:'#task-records',duration:200}).catch(()=>setNavigationStatus('请查看本页练习记录。')))
 }
 const eligible=taskEligibility(activeTask,profile)
 const setupNeeded=!eligible.allowed&&!['done','blocked','loading'].includes(phase)
 const stages={loading:'正在恢复',blocked:'记录受保护',first:'准备第一轮',draft:'第一轮草稿',retake:'等待复拍',done:'两轮已完成'}
 const next={loading:'读取本机草稿和已保存记录',blocked:'查看读取提示，原记录保持不变',first:'填写意图、条件和这次观察',draft:'继续补全意图、条件和观察',retake:'只改一个变量，记录复拍与反思',done:'回看两轮条件与自述差异'}
 const actions={loading:'正在恢复记录…',blocked:'查看记录状态',first:'开始第一轮记录',draft:'继续第一轮记录',retake:'继续复拍记录',done:'查看两轮记录'}
 return <View className='page'>
  <View className='page-heading'><View className='title'>练习</View><View className='caption'>摄影手册</View></View>
  <View className='current-practice'>
   <View className='hero-top'><View className='caption'>当前练习</View><View className='practice-stage'>{stages[phase]}</View></View>
   <View className='task-title'>{practiceTasks[activeTask].title}</View>
   <View className='note'>{practiceTasks[activeTask].goal}</View>
   <View className='next-step'>下一步：{setupNeeded?'确认设备与常亮灯条件':next[phase]}</View>
   <Button className='primary-action' disabled={phase==='loading'} onClick={()=>setupNeeded?setPanel('setup'):recordEntry()}>{setupNeeded?'先确认设备条件':actions[phase]}</Button>
   <View className='caption'>设备：{profile.device==='r7'?'R7':'手机'}（自报） · 仅本机手填记录</View>
  </View>
  <View className='panel-tabs'>
   {([['record','练习记录'],['setup','设备与任务'],['light','单灯模拟']] as const).map(([id,label])=><Button className={panel===id?'selected':'secondary'} key={id} onClick={()=>setPanel(id)}>{label}</Button>)}
  </View>
  <View className='caption'>手填练习与固定 Mock 反馈；照片读取请用底部「照片」。</View>
  <View className='note'>{navigationStatus}</View>
  <View id='task-records' hidden={panel!=='record'}>
   <LearningLoop key={activeTask} light={light} exerciseId={activeTask} canRecord={eligible.allowed} eligibilityMessage={eligible.reason} active={visible&&panel==='record'} onPhase={setPhase}/>
  </View>
  <View hidden={panel!=='setup'}>
   <View className='section'><PracticeTasks profile={profile} onSelect={recordEntry}/></View>
   <ExposureLesson includeTasks={false} onProfile={setProfile} onTask={recordEntry} onPlan={setPlan} onStart={()=>{setActiveTask('single-light-bust-v1');setPanel('light');setNavigationStatus('已进入单灯练习；下方已有两轮记录不会被覆盖。');Taro.nextTick(()=>Taro.pageScrollTo({selector:'#single-light-practice',duration:200}).catch(()=>setNavigationStatus('请查看单灯模拟分区。')))}}/>
  </View>
  <View hidden={panel!=='light'}>
  <View className='card' id='single-light-practice'>
   <View className='label'>{plan.title}</View>
   <View className='note'>当前设备提示（不是历史拍摄事实）：{plan.conditions}</View>
   {plan.steps.map(s=><View className='note' key={s}>{s}</View>)}
   <View className='note'>{plan.limitation}</View>
   <View className='label'>观察光，不急着打分</View>
   <Text className='note'>{fixture.title}。先用 ML100 或徕凯 40W 单灯练习；V1 留待闪光专题。</Text>
   <Canvas type='2d' id='light-canvas' style={{height:canvasHeight+'px'}} />
   {canvasError && <View className='badge'>{canvasError}</View>}
   <View className='label'>灯位：{light.angle}°</View>
   <Slider min={-90} max={90} step={5} value={light.angle} onChange={e=>setLight({...light,angle:e.detail.value})} />
   <View className='label'>灯距：{light.distance.toFixed(1)} 米</View>
   <Slider min={5} max={30} step={1} value={Math.round(light.distance*10)} onChange={e=>setLight({...light,distance:e.detail.value/10})} />
   <View className='label'>相对输出：{light.power}%</View>
   <Slider min={10} max={100} step={10} value={light.power} onChange={e=>setLight({...light,power:e.detail.value})} />
   <View className='note'>相对 1 米 / 100%：{lightStops(light).toFixed(2)} 档。仅理想点光源距离教学，不代表灯具真实调光曲线。</View>
   <Button className='secondary' onClick={()=>setLight({...initialLight})}>重置参数（保留观察文字）</Button>
  </View>
  <View className='card'>
   <View className='label'>按当前设备提示观察单灯</View>
   <View className='note'>原始任务以 R7 和大卫石膏像为背景；手机按上方能力提示练习。已有两轮闭环在下方，当前设备选择不会改写历史记录。</View>
   <View className='label'>这次观察到了什么？</View>
   <Textarea ariaLabel='单灯模拟观察（不是实拍）' maxlength={500} value={observation} placeholder='例如：灯向侧面移，鼻影向另一侧延长……' onInput={e=>setObservation(e.detail.value)} />
   <Button onClick={save}>保存本机练习</Button>
   <Button className='secondary' onClick={clear}>清除本机参数与观察</Button>
   <View className='note'>{status}</View>
  </View>
  <Button className='text-action' onClick={()=>setSampleOpen(v=>!v)}>{sampleOpen?'收起固定样例说明':'查看固定样例说明'}</Button>
  <View className='card' hidden={!sampleOpen}>
   <View className='label'>样例点评，不针对你的照片</View>
   <View className='note'>事实：{fixture.review.fact}</View>
   <View className='note'>推断边界：{fixture.review.inference}</View>
   <View className='note'>下一步：{fixture.review.suggestion}</View>
  </View>
   <Button onClick={()=>recordEntry()}>把观察写进当前练习</Button>
   <View className='caption'>球面为近似示意，不是实拍预测。ISO 不增加入射光。</View>
  </View>
 </View>
}
