// Diagram coordinates, not sensor pixels or a calibrated subject-speed model.
export const motionShutters=[
 {id:'s-125',label:'运动示意：1/125 秒',seconds:1/125},
 {id:'s-250',label:'运动示意：1/250 秒',seconds:1/250},
 {id:'s-500',label:'运动示意：1/500 秒',seconds:1/500},
 {id:'s-62',label:'运动示意：1/62.5 秒',seconds:1/62.5}
] as const
export const motionSpeeds=[
 {id:'slow',label:'示意速度：1000 单位/秒',unitsPerSecond:1000},
 {id:'fast',label:'示意速度：2000 单位/秒',unitsPerSecond:2000}
] as const
export function motionDistance(seconds:number,unitsPerSecond:number):number{
 if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(unitsPerSecond)||unitsPerSecond<0)
  throw new RangeError('曝光时间须为正数，示意速度须为非负有限数')
 const distance=seconds*unitsPerSecond
 if(!Number.isFinite(distance))throw new RangeError('示意轨迹超出可表示范围')
 return distance
}
