import {View,Button} from '@tarojs/components'
import {taskIds,practiceTasks,taskEligibility,type ExerciseId} from '../../../../../packages/photography-core/src/practice-tasks'
import type {Profile} from '../../../../../packages/photography-core/src/exposure-lesson'
export default function PracticeTasks({profile,onSelect}:{profile:Profile;onSelect:(id:ExerciseId)=>void}){
 return <View>
  <View className='label'>三类任务 · 先看条件再记录</View>
  <View className='note'>这些是可自行执行的实拍任务单。演示或计算作答不会自动成为实拍；任务记录仍是无照片的手填报告与 Mock 点评。</View>
  {taskIds.map(id=><View key={id}>
   <Button className='secondary' onClick={()=>onSelect(id)}>查看{id==='single-light-bust-v1'?'单灯控制变量':practiceTasks[id].title}与记录</Button>
   <View className='note'>{taskEligibility(id,profile).reason}</View>
  </View>)}
 </View>
}
