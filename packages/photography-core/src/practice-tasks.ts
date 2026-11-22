import {capabilities,type Profile} from './exposure-lesson.ts'
export const taskIds=['single-light-bust-v1','exposure-compensation-v1','shutter-motion-v1'] as const
export type ExerciseId=typeof taskIds[number]
export const isExerciseId=(id:unknown):id is ExerciseId=>typeof id==='string'&&(taskIds as readonly string[]).includes(id)
export const practiceTasks={
 'single-light-bust-v1':{
  title:'单灯任务',goal:'固定机位与曝光，观察一盏灯改变后鼻影和明暗交界的变化。',
  start:'先选一盏常亮灯与静物；无常亮灯时，只做已标注的单灯模拟观察。',
  submission:'记录意图、设备、实际条件与观察；复拍只改一个灯光变量，并记录其他差异。模拟观察须自己明确写出。',
  observe:'核对鼻影、明暗交界和背景；不凭亮度直接判失败。',
  suggestions:['固定机位、构图与曝光，只改变一个灯光变量。','复拍后记录鼻影、明暗交界及背景变化，并列出其他条件差异。'],
  next:'下一项练习：在真实设备上固定其他条件，仅改变灯距，检查鼻影与背景变化。'
 },
 'exposure-compensation-v1':{
  title:'曝光补偿任务',goal:'在常亮光下比较快门变化和 ISO 补偿，区分等效曝光指数与实际光量。',
  start:'仅用 ML100 或徕凯 40W 常亮灯与静物。固定机位、构图、光圈和灯光，关闭自动 ISO；手填自己设备实际可用的起始快门与 ISO，不强设 f/4。',
  submission:'第一轮记录起始快门/ISO、意图和观察。第二轮把曝光时间减半、ISO 加倍（须均在可用范围），写实际值、观察、其他变化和不确定性；做不到就不强设。',
  observe:'比较明暗与细节；ISO 加倍没有补回光子，不因等效指数一致就认定画质相同。未核对的参数写未知。',
  suggestions:['用固定常亮灯和静物，核对自动 ISO 已关闭及相邻参数确实可用。','记录前后实际快门/ISO与观察；把等效指数补偿和光量变化分开解释。'],
  next:'下一步：用同一静物检查重复性，保留设备处理和照度变化的不确定性。'
 },
 'shutter-motion-v1':{
  title:'凝固/模糊任务',goal:'观察同一类横向运动在较短和较长曝光时间下的轨迹差异，不预设必须凝固或清晰。',
  start:'仅用 ML100 或徕凯 40W 常亮灯，固定相机与背景，选择安全可重复的横向运动主体；用设备实际可用且能记录的两个快门时间，关闭自动 ISO。V1 同步另讲。',
  submission:'第一轮记录较短快门、ISO、意图、运动方向和观察；第二轮用较长曝光时间重复类似运动，记录实际参数、照明与运动差异及反思，不把两次速度假设为相同。',
  observe:'比较轨迹长度、背景稳定性与明暗。较长曝光也可能变亮；主体速度不同或手抖时不可直接归因于快门。',
  suggestions:['固定机位与背景，使用常亮光，记录自己设备确实可用的两个快门时间。','对照轨迹和背景，把速度、照度或曝光差异写清；不把模糊自动判为失败。'],
  next:'下一步：在安全且可重复的运动条件下复查，不能从手填记录断言画面成功。'
 }
} as const
export function taskEligibility(id:ExerciseId,profile:Profile){
 if(id==='single-light-bust-v1')return {allowed:true,reason:'可按已有设备提示做单灯观察；模拟须在意图和观察中明确标记。'}
 const c=capabilities(profile)
 if(!c.shutter||!c.iso)return {allowed:false,reason:'须先在设备上确认手动快门与 ISO；当前可查看任务与旧记录，不能填写新实拍记录。'}
 if(!['ml100','likai40'].includes(profile.lamp))return {allowed:false,reason:'本任务仅用 ML100 或徕凯 40W 常亮灯；V1、未确认光源或其他灯具不用于这张基础任务。'}
 return {allowed:true,reason:'已确认基本控制能力；仍须自行核对实际可用参数。记录为手填报告，尚无照片验证。'}
}
