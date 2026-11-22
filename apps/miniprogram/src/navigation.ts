import type {ExerciseId} from '../../../packages/photography-core/src/practice-tasks'
export type Tab='practice'|'photos'|'records'
export const routes={practice:'/pages/index/index',photos:'/pages/photos/index',records:'/pages/records/index'} as const
let visible:Tab='practice'
let requested:ExerciseId|null=null
const listeners=new Set<(tab:Tab)=>void>()
export const currentTab=()=>visible
export function showTab(tab:Tab){visible=tab;listeners.forEach(fn=>fn(tab))}
export function observeTab(fn:(tab:Tab)=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}
export function requestExercise(id:ExerciseId){requested=id}
export function consumeExercise(){const id=requested;requested=null;return id}
