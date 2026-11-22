import PracticeTasks from './practice-tasks'
import type {ExerciseId} from '../../../../../packages/photography-core/src/practice-tasks'
import ShutterMotion from './shutter-motion'
import ExposureCompensation from './exposure-compensation'
import {useRef,useState} from 'react'
import Taro,{useReady} from '@tarojs/taro'
import {View,Button} from '@tarojs/components'
import {PROFILE_KEY,defaultProfile,restoreProfile,selectDevice,capabilities,practicePlan,exposureComparison,examples,type Profile} from '../../../../../packages/photography-core/src/exposure-lesson'
type Plan=ReturnType<typeof practicePlan>
export default function ExposureLesson({onPlan,onStart,onProfile,onTask,includeTasks=true}:{onPlan:(plan:Plan)=>void;onStart:()=>void;onProfile:(p:Profile)=>void;onTask:(id:ExerciseId)=>void;includeTasks?:boolean}){
 const [profile,setProfile]=useState<Profile>(defaultProfile)
 const current=useRef(profile)
 const [ready,setReady]=useState(false)
 const [blocked,setBlocked]=useState(false)
 const [status,setStatus]=useState('正在读取设备档案…')
 const [example,setExample]=useState(0)
 const [lessonOpen,setLessonOpen]=useState(false)
 function show(p:Profile){current.current=p;setProfile(p);onPlan(practicePlan(p));onProfile(p)}
 useReady(()=>{
  try{
   const raw=Taro.getStorageSync(PROFILE_KEY)
   if(raw!==''&&raw!==null&&raw!==undefined){
    const p=restoreProfile(raw)
    if(!p){setBlocked(true);setStatus('设备记录无法读取，保留原数据；请重新进入或检查版本。');setReady(true);return}
    show(p);setStatus('已恢复本机设备档案（用户自报，未经设备检测）。')
   }else {onProfile(current.current);onPlan(practicePlan(current.current));setStatus('先选择设备与灯具；未确认的能力不会用于安排实拍。')}
  }catch{setBlocked(true);setStatus('读取失败，已停止写入；请重新进入页面。')}
  setReady(true)
 })
 function save(p:Profile){
  if(!ready||blocked)return
  try{
   if(!restoreProfile(p))throw Error('invalid profile')
   Taro.setStorageSync(PROFILE_KEY,p);show(p);setStatus('设备选择已保存本机；未改变已有练习记录。')
  }catch{setStatus('保存失败，仍使用上次设备选择。请重试。')}
 }
 const c=capabilities(profile),plan=practicePlan(profile),result=exposureComparison(examples[example].value)
 const signed=(n:number)=>(n>=0?'+':'')+n.toFixed(2)
 return <View className='card' id='exposure-lesson'>
  <View className='label'>先选设备，再学一档曝光</View>
  <View className='badge'>离线微课 · 能力由你确认 · 不读取照片或设备</View>
  <View className='note'>{status}</View>
  <View className='choice-row'>
   <Button disabled={!ready||blocked} className='secondary' onClick={()=>save(selectDevice(current.current,'r7'))}>选择 R7</Button>
   <Button disabled={!ready||blocked} className='secondary' onClick={()=>save(selectDevice(current.current,'phone'))}>选择手机</Button>
  </View>
  <View className='label'>当前设备：{profile.device==='r7'?'R7':'手机'}</View>
  <View className='note'>{profile.device==='r7'?'R7 的 M 模式可设快门、光圈和 ISO，但可用光圈受镜头限制。先在自己的设备上确认；本课不要求固定的镜头或光圈值。':'手机能力取决于机型与拍摄应用。本卡不假设可调光圈；只有亲自确认专业模式可调快门和 ISO 后才启用对应实拍提示。'}</View>
  <Button disabled={!ready||blocked} className='secondary' onClick={()=>save({...current.current,manualConfirmed:!current.current.manualConfirmed})}>手动快门与 ISO：{profile.manualConfirmed?'已确认':'未确认'}（点此切换）</Button>
  {profile.device==='r7'&&<Button disabled={!ready||blocked} className='secondary' onClick={()=>save({...current.current,apertureConfirmed:!current.current.apertureConfirmed})}>镜头可调光圈：{profile.apertureConfirmed?'已确认':'未确认'}（点此切换）</Button>}
  <Button disabled={!ready||blocked} className='secondary' onClick={()=>save({...current.current,lockConfirmed:!current.current.lockConfirmed})}>曝光锁定：{profile.lockConfirmed?'已确认':'未确认'}（点此切换）</Button>
  <View className='note'>可用于实拍的已确认能力：快门 {c.shutter?'是':'否'} / ISO {c.iso?'是':'否'} / 光圈 {c.aperture?'是':'否'}。切换设备会清除能力确认，避免套用上一台设备。</View>
  <View className='label'>本轮光源（选择一项）</View>
  {([['ml100','ML100 常亮灯'],['likai40','徕凯 40W 常亮灯'],['other','其他已确认常亮灯'],['v1','V1 闪光灯'],['none','暂无常亮灯']] as [Profile['lamp'],string][]).map(([lamp,label])=><Button disabled={!ready||blocked} className='secondary' key={lamp} onClick={()=>save({...current.current,lamp})}>{profile.lamp===lamp?'✓ ':''}{label}</Button>)}
  <Button className='text-action' onClick={()=>setLessonOpen(v=>!v)}>{lessonOpen?'收起曝光微课':'展开曝光微课'}</Button>
  <View hidden={!lessonOpen}>
  <View className='label'>微课：同一场景，什么改变了光量？</View>
  <View className='note'>在场景照度、透光率等不变的理想条件下，传感器单位面积收到的曝光量与“曝光时间 ÷ 光圈值²”成正比。快门时间减半少一档；f/4 到 f/8 少两档。</View>
  <View className='note'>ISO 不增加入射光。提高一档 ISO 只是这里的曝光指数项增加一档，不会补回更短快门损失的光子；相同等效档数不保证相同噪声、动态范围或照片效果。</View>
  <View className='note'>下列按钮是所有设备都能操作的教学计算示例，不是要求手机设置这些参数；也不会改动你的单灯或复拍记录。</View>
  {examples.map((e,i)=><Button className='secondary' key={e.id} onClick={()=>setExample(i)}>{example===i?'✓ ':''}{e.title}</Button>)}
  <View className='badge'>相对基准：光量项 {signed(result.lightStops)} 档；ISO 指数项 {signed(result.isoStops)} 档；等效合计 {signed(result.equivalentStops)} 档。</View>
  <View className='note'>f/8 的补偿例用 1/31.25 秒精确演算；设备通常显示近似刻度，不必强设。运动轨迹与曝光时间的关系可在下方静态示意中观察。</View>
  <ExposureCompensation />
  <ShutterMotion />
  </View>
  {includeTasks&&<PracticeTasks profile={profile} onSelect={onTask} />}
  <View className='label'>适合当前设备的练习：{plan.title}</View>
  {plan.steps.map(s=><View className='note' key={s}>{s}</View>)}
  <View className='note'>{plan.limitation}</View>
  <Button disabled={!ready||blocked} onClick={onStart}>进入已有单灯练习与记录</Button>
 </View>
}
