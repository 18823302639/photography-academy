import {exposureStops} from './index.ts'

export const PROFILE_KEY='photography-academy:device-profile:v1'
export type Profile={version:1;device:'r7'|'phone';manualConfirmed:boolean;apertureConfirmed:boolean;lockConfirmed:boolean;lamp:'ml100'|'likai40'|'other'|'v1'|'none'}
export const defaultProfile=():Profile=>({version:1,device:'phone',manualConfirmed:false,apertureConfirmed:false,lockConfirmed:false,lamp:'none'})
export function restoreProfile(raw:unknown):Profile|null{
 const p=raw as Profile
 if(!p||p.version!==1||!['r7','phone'].includes(p.device)||!['ml100','likai40','other','v1','none'].includes(p.lamp)||
  !['manualConfirmed','apertureConfirmed','lockConfirmed'].every(k=>typeof p[k as keyof Profile]==='boolean'))return null
 // Phone aperture control is outside this minimal card; never infer it from camera branding.
 if(p.device==='phone'&&p.apertureConfirmed)return null
 return {version:1,device:p.device,manualConfirmed:p.manualConfirmed,apertureConfirmed:p.apertureConfirmed,lockConfirmed:p.lockConfirmed,lamp:p.lamp}
}
export function selectDevice(p:Profile,device:Profile['device']):Profile{
 return {...p,device,manualConfirmed:false,apertureConfirmed:false,lockConfirmed:false}
}
export function capabilities(p:Profile){
 return {shutter:p.manualConfirmed,iso:p.manualConfirmed,aperture:p.device==='r7'&&p.apertureConfirmed,
  exposureLock:p.lockConfirmed,continuous:['ml100','likai40','other'].includes(p.lamp)}
}
export function practicePlan(p:Profile){
 const c=capabilities(p)
 const device=p.device==='r7'?'R7':'手机'
 const lamps={ml100:'ML100 常亮灯',likai40:'徕凯 40W 常亮灯',other:'已确认的其他常亮灯',v1:'V1 闪光灯',none:'无已确认常亮灯'}
 if(!c.continuous)return {mode:'simulation' as const,title:'先做单灯模拟观察',
  conditions:device+'；'+lamps[p.lamp]+'；模拟练习，未提交照片',
  steps:['在上方示意中只改变灯距，观察理想点光源的档数变化。','把意图写为“模拟理解单灯距离”，记录所见；复拍栏写第二次模拟观察，不冒充实拍。'],
  limitation:p.lamp==='v1'?'V1 不作为本课常亮灯，不能用本页距离/快门示例预测闪光曝光。':'没有确认常亮灯时，只安排可离线完成的模拟记录。'}
 return {mode:'practice' as const,title:'单灯观察 → 第一轮 → 只改灯距再记录',
  conditions:device+'；'+lamps[p.lamp]+'；'+(c.shutter?'已确认手动快门/ISO':'未确认手动快门/ISO')+'；'+(c.aperture?'已确认可调光圈':'不要求调光圈'),
  steps:[c.shutter?'固定机位、构图、快门与 ISO；关闭自动 ISO。光圈保持当前值，镜头不支持示例值也不必强设。':c.exposureLock?'固定机位与构图，使用已确认的曝光锁定；把无法确认的快门/ISO 写为未知。':'固定机位与构图；未确认曝光锁定或手动能力，只比较阴影形状，亮度可能被自动曝光改变。',
   '第一轮记录鼻影、明暗交界及背景。随后只改变灯距，记下其他实际条件变化，再到已有闭环填写复拍反思。'],
  limitation:c.shutter||c.exposureLock?'实际灯具、附件、反射和手机计算处理可能偏离理想公式；记录实际现象，不推断固定提升。':'不能把亮度变化归因于灯距，也不布置手动光圈或快门补偿任务。'}
}
export type Exposure={aperture:number;seconds:number;iso:number}
export const BASE:Exposure={aperture:4,seconds:1/125,iso:100}
export function exposureComparison(e:Exposure){
 const total=exposureStops(e.aperture,e.seconds,e.iso)
 const light=exposureStops(e.aperture,e.seconds,BASE.iso)
 return {lightStops:light,isoStops:Math.log2(e.iso/BASE.iso),equivalentStops:total}
}
export const examples=[
 {id:'base',title:'基准：f/4 · 1/125 秒 · ISO 100',value:BASE},
 {id:'shutter',title:'快门加快一档：f/4 · 1/250 秒 · ISO 100',value:{...BASE,seconds:1/250}},
 {id:'iso',title:'用 ISO 补一档：f/4 · 1/250 秒 · ISO 200',value:{...BASE,seconds:1/250,iso:200}},
 {id:'aperture',title:'光圈缩小两档：f/8 · 1/125 秒 · ISO 100',value:{...BASE,aperture:8}},
 {id:'compensated',title:'延时补两档：f/8 · 1/31.25 秒 · ISO 100',value:{aperture:8,seconds:1/31.25,iso:100}}
] as const

export const compensationExercises=[
 {id:'iso-compensation',title:'练习 A：快门减半，只改 ISO',prompt:'基准为 f/4、1/125 秒、ISO 100。改为 1/250 秒并保持 f/4，选择 ISO，让等效合计回到基准。',criterion:'equivalentStops',
  explanation:'快门时间减半，光量项仍少一档；ISO 200 使指数项加一档，等效合计归零，但没有补回光子，也不保证相同画质。',
  choices:[
   {id:'iso-100',label:'试选 ISO 100',value:{aperture:4,seconds:1/250,iso:100}},
   {id:'iso-200',label:'试选 ISO 200',value:{aperture:4,seconds:1/250,iso:200}},
   {id:'iso-400',label:'试选 ISO 400',value:{aperture:4,seconds:1/250,iso:400}}
  ]},
 {id:'time-compensation',title:'练习 B：缩小光圈，只改时间',prompt:'同一照度下，基准为 f/4、1/125 秒、ISO 100。改为 f/8 并保持 ISO 100，选择曝光时间，让光量项回到基准。',criterion:'lightStops',
  explanation:'f/4 到 f/8 少两档，需要曝光时间乘四，精确演算为 1/31.25 秒。ISO 保持不变；实际更长曝光可能改变运动模糊，这里只核对理想光量关系。',
  choices:[
   {id:'time-500',label:'试选 1/500 秒',value:{aperture:8,seconds:1/500,iso:100}},
   {id:'time-125',label:'试选 1/125 秒',value:{aperture:8,seconds:1/125,iso:100}},
   {id:'time-31',label:'试选 1/31.25 秒',value:{aperture:8,seconds:1/31.25,iso:100}}
  ]}
] as const
export function evaluateCompensation(exerciseId:string,choiceId:string){
 const exercise=compensationExercises.find(e=>e.id===exerciseId)
 if(!exercise)throw Error('未知的补偿练习')
 const choice=exercise.choices.find(c=>c.id===choiceId)
 if(!choice)throw Error('选项不属于当前练习')
 const comparison=exposureComparison(choice.value)
 return {comparison,correct:Math.abs(comparison[exercise.criterion])<1e-9,explanation:exercise.explanation}
}
