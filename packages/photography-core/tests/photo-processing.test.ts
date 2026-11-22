import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parsePhotoProcessingOutcome} from '../src/photo-processing.ts'
const cases=JSON.parse(readFileSync(new URL('../../contracts/photo-processing.fixture.json',import.meta.url),'utf8'))
const copy=()=>JSON.parse(JSON.stringify(cases.normal))
test('all Python-produced outcomes parse with exact fields and privacy scope, without retained references',()=>{
 for(const report of Object.values(cases))assert.deepEqual(parsePhotoProcessingOutcome(report),report)
 const raw=copy(),parsed=parsePhotoProcessingOutcome(raw)
 assert.ok(parsed&&parsed.status==='processed')
 raw.exif.values.iso=999;raw.exif.owner='SYNTHETIC_PRIVATE';raw.input.size.width=1
 assert.equal(parsed.exif.values.iso,200);assert.equal(parsed.input.size.width,96)
 assert.equal('owner' in parsed.exif,false)
 assert.equal(parsed.original_bytes,'unchanged');assert.equal(parsed.derived.pixel_content,'not_anonymized')
})
test('PII, paths and unknown keys are rejected at every contract object, including failures',()=>{
 for(const target of ['root','input','input.size','exif','exif.values','exif.states','derived','derived.size']){
  const r=copy();const obj=target==='root'?r:target.split('.').reduce((o,k)=>o[k],r)
  obj.private_path='/SYNTHETIC/PRIVATE/source.jpg';assert.equal(parsePhotoProcessingOutcome(r),null)
 }
 assert.equal(parsePhotoProcessingOutcome({...cases.over_pixels,message:'/SYNTHETIC/PRIVATE'}),null)
 assert.equal(parsePhotoProcessingOutcome({...cases.over_pixels,code:'arbitrary failure details'}),null)
 const getter=copy();Object.defineProperty(getter.exif.values,'iso',{get:()=>{throw Error('must not call')},enumerable:true})
 assert.equal(parsePhotoProcessingOutcome(getter),null)
})
test('state/value contradictions, coercible scalars and unsupported EXIF ranges are rejected',()=>{
 for(const value of ['200',true,0,-1,NaN,Infinity,1.5,10_000_001]){
  const r=copy();r.exif.values.iso=value;assert.equal(parsePhotoProcessingOutcome(r),null)
 }
 for(const mutate of [(r:any)=>{r.exif.values.iso=null},(r:any)=>{r.exif.states.iso='missing'},
  (r:any)=>{r.exif.container='absent'},(r:any)=>{r.exif.states.iso='unreadable'},
  (r:any)=>{r.exif.values.orientation=9},(r:any)=>{r.exif.values.exposure_seconds=86401}]){
  const r=copy();mutate(r);assert.equal(parsePhotoProcessingOutcome(r),null)
 }
 assert.equal(cases.invalid_fields.exif.states.iso,'invalid')
 assert.equal(cases.unreadable_exif.exif.states.iso,'unreadable')
 assert.equal(cases.no_exif.exif.states.iso,'missing')
})
test('transformation claims cannot conceal unchanged originals, pixel identity, orientation or size',()=>{
 for(const mutate of [(r:any)=>{r.original_bytes='stripped'},(r:any)=>{r.derived.pixel_content='anonymized'},
  (r:any)=>{r.derived.metadata='copied'},(r:any)=>{r.derived.orientation='not_present'},
  (r:any)=>{r.derived.size.width=97},(r:any)=>{r.input.bytes=10*1024*1024+1},
  (r:any)=>{r.input.size={width:9000,height:5000}}]){
  const r=copy();mutate(r);assert.equal(parsePhotoProcessingOutcome(r),null)
 }
})
