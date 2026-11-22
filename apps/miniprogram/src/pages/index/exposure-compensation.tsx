import {useState} from 'react'
import {View,Button} from '@tarojs/components'
import {compensationExercises,evaluateCompensation} from '../../../../../packages/photography-core/src/exposure-lesson'

export default function ExposureCompensation(){
 const [exerciseId,setExerciseId]=useState<string>(compensationExercises[0].id)
 const [choiceId,setChoiceId]=useState<string|null>(null)
 const exercise=compensationExercises.find(e=>e.id===exerciseId)!
 const feedback=choiceId?evaluateCompensation(exerciseId,choiceId):null
 const signed=(v:number)=>(v>=0?'+':'')+v.toFixed(2)
 function change(id:string){setExerciseId(id);setChoiceId(null)}
 return <View>
  <View className='label'>自己选一次补偿方案</View>
  <View className='note'>这是常亮光下的计算练习，所有设备均可作答，不要求手机或镜头支持示例参数。V1 闪光同步另讲。</View>
  {compensationExercises.map(e=><Button key={e.id} className='secondary' onClick={()=>change(e.id)}>{e.title}</Button>)}
  <View className='label'>{exercise.title}</View>
  <View className='note'>{exercise.prompt}</View>
  {exercise.choices.map(c=><Button key={c.id} className='secondary' onClick={()=>setChoiceId(c.id)}>{choiceId===c.id?'✓ ':''}{c.label}</Button>)}
  {!feedback&&<View className='note'>先选择一个方案，再核对档数和原因。</View>}
  {feedback&&<View>
   <View className='badge'>{feedback.correct?'本次计算相符':'尚未回到目标，可换一个方案'}。光量项 {signed(feedback.comparison.lightStops)} 档；ISO 指数项 {signed(feedback.comparison.isoStops)} 档；等效合计 {signed(feedback.comparison.equivalentStops)} 档。</View>
   <View className='note'>{feedback.explanation}</View>
   <Button className='secondary' onClick={()=>setChoiceId(null)}>重新作答本题</Button>
  </View>}
  <View className='note'>本页作答可反复尝试，重进后重新开始；不会改写两轮练习记录，也不作为已掌握摄影技能的证据。</View>
 </View>
}
