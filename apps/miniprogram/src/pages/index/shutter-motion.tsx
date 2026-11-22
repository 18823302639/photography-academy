import {useState} from 'react'
import {View,Button} from '@tarojs/components'
import {motionDistance,motionShutters,motionSpeeds} from '../../../../../packages/photography-core/src/motion'

export default function ShutterMotion(){
 const [shutter,setShutter]=useState(0)
 const [speed,setSpeed]=useState(1)
 const seconds=motionShutters[shutter].seconds,velocity=motionSpeeds[speed].unitsPerSecond
 const length=motionDistance(seconds,velocity)
 const ratio=seconds/(1/125)
 return <View>
  <View className='label'>快门与运动轨迹 · 静态示意</View>
  <View className='note'>假设相机固定，点状主体在画面内匀速横移。条带表示一次曝光期间经过的位置；这里的速度和长度只用页面示意单位，不对应实拍速度或传感器像素。</View>
  {motionShutters.map((s,i)=><Button className='secondary' key={s.id} onClick={()=>setShutter(i)}>{shutter===i?'✓ ':''}{s.label}</Button>)}
  {motionSpeeds.map((s,i)=><Button className='secondary' key={s.id} onClick={()=>setSpeed(i)}>{speed===i?'✓ ':''}{s.label}</Button>)}
  <View className='motion-track'>
   <View className='motion-origin' />
   <View className='motion-trail' style={{width:length+'%'}} />
   <View className='motion-end' style={{left:(10+length)+'%'}} />
  </View>
  <View className='note'>同一标尺：左线为起点，条带到圆点为曝光轨迹。长度 {length.toFixed(2)} 示意单位；在当前相同速度下，相对 1/125 秒为 {ratio.toFixed(2)} 倍。</View>
  <View className='note'>时间减半，轨迹长度减半；同一时间速度加倍，轨迹长度加倍。固定照度与光圈时，更长曝光也增加光量；这里不模拟亮度、景深、手抖、滚动快门或计算摄影。</View>
  <View className='note'>图形是静态轨迹叠加，不保证真实照片的模糊程度或“凝固”效果。1/62.5 秒用于精确演算，不要求设备有该刻度；V1 闪光同步另讲。仅用于本页理解，不改已有两轮记录。</View>
 </View>
}
