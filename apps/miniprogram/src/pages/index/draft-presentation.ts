// Read-only UI classification. Does not change the persisted Loop or submission rules.
import type {Loop} from '../../../../../packages/photography-core/src/learning-loop'
import {EXERCISE} from '../../../../../packages/photography-core/src/learning-loop'
import {initialLight} from '../../../../../packages/photography-core/src/index'
export function hasDraftContent(loop:Loop|null):boolean{
 if(!loop)return false
 if(Object.values(loop.draft).some(value=>typeof value==='string'&&value.trim()))return true
 return loop.exerciseId===EXERCISE&&(['angle','distance','power'] as const).some(key=>loop.draft.light[key]!==initialLight[key])
}
