import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {readJpegExif,EXIF_READ_LIMIT} from '../src/local-exif.ts'
import {parseExifProjection} from '../src/photo-processing.ts'
const cases=JSON.parse(readFileSync(new URL('../../contracts/photo-processing.fixture.json',import.meta.url),'utf8'))
const fixture=(name:string)=>readFileSync(new URL('../../../tests/fixtures/exif-contract/'+name+'.jpg',import.meta.url))
async function inspect(bytes:Uint8Array){
 let reads=0,total=0
 const result=await readJpegExif(bytes.length,async(position,length)=>{
  reads++;total+=length;assert.ok(position>=0&&position+length<=bytes.length);assert.ok(total<=EXIF_READ_LIMIT)
  return new Uint8Array(bytes.subarray(position,position+length))
 })
 return {result,reads,total}
}
// Only a structural metadata fixture: the image renderer is tested separately with real JPEGs.
function tiff(little:boolean){
 const bytes=Buffer.alloc(116),w16=(p:number,v:number)=>little?bytes.writeUInt16LE(v,p):bytes.writeUInt16BE(v,p),
  w32=(p:number,v:number)=>little?bytes.writeUInt32LE(v,p):bytes.writeUInt32BE(v,p)
 bytes.write(little?'II':'MM');w16(2,42);w32(4,8);w16(8,2)
 function entry(at:number,tag:number,type:number,value:number){w16(at,tag);w16(at+2,type);w32(at+4,1);type===3?w16(at+8,value):w32(at+8,value)}
 entry(10,274,3,6);entry(22,34665,4,38);w16(38,4)
 entry(40,33434,5,92);entry(52,33437,5,100);entry(64,34855,3,200);entry(76,37386,5,108)
 w32(92,1);w32(96,125);w32(100,4);w32(104,1);w32(108,50);w32(112,1)
 return {bytes,w16,w32}
}
function segment(payload:Uint8Array){const len=payload.length+2;return Buffer.concat([Buffer.from([255,225,len>>8,len&255]),payload])}
const exifSegment=(bytes:Uint8Array)=>segment(Buffer.concat([Buffer.from('Exif\0\0'),bytes]))
const jpeg=(bytes:Uint8Array)=>Buffer.concat([Buffer.from([255,216]),exifSegment(bytes),Buffer.from([255,218])])
test('actual synthetic JPEG EXIF matches the Python projection for available, absent, invalid, unreadable and XMP-only cases',async()=>{
 for(const name of ['normal','no_exif','invalid_fields','unreadable_exif','xmp_only']){
  const bytes=fixture(name),before=Buffer.from(bytes);const {result}=await inspect(bytes)
  assert.deepEqual(result,cases[name].exif);assert.deepEqual(bytes,before)
  assert.ok(parseExifProjection(result))
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE'))
 }
 assert.ok(fixture('normal').includes(Buffer.from('SYNTHETIC_PRIVATE')),'projection never strips source bytes')
})
test('both TIFF byte orders decode only five approved scalar tags',async()=>{
 for(const little of [true,false]){
  const {bytes}=tiff(little)
  assert.deepEqual((await inspect(jpeg(bytes))).result,cases.normal.exif)
 }
})
test('TIFF cycles, table/count overflow, duplicate known tags, invalid offsets and BigTIFF remain unreadable',async()=>{
 for(const mutate of [(t:ReturnType<typeof tiff>)=>t.w16(8,257),(t:ReturnType<typeof tiff>)=>t.w32(30,8),
  (t:ReturnType<typeof tiff>)=>t.w32(48,0xfffffff0),(t:ReturnType<typeof tiff>)=>t.w16(22,274),
  (t:ReturnType<typeof tiff>)=>t.w16(2,43),(t:ReturnType<typeof tiff>)=>t.w32(30,10)]){
  const t=tiff(true);mutate(t);assert.equal((await inspect(jpeg(t.bytes))).result.container,'unreadable')
 }
})
test('unsupported count/type and zero denominator invalidate a field without fabricating it; GPS pointers are not traversed',async()=>{
 for(const mutate of [(t:ReturnType<typeof tiff>)=>t.w32(44,2),(t:ReturnType<typeof tiff>)=>t.w16(42,2),
  (t:ReturnType<typeof tiff>)=>t.w32(96,0)]){
  const t=tiff(false);mutate(t);const {result}=await inspect(jpeg(t.bytes))
  assert.equal(result.container,'read');assert.equal(result.states.exposure_seconds,'invalid');assert.equal(result.values.exposure_seconds,null)
  assert.equal(result.values.iso,200)
 }
 const t=tiff(true);t.w16(10,34853);t.w16(12,4);t.w32(18,0xffffffff)
 const {result}=await inspect(jpeg(t.bytes));assert.equal(result.container,'read');assert.equal(result.values.iso,200)
 assert.equal(result.states.orientation,'missing');assert.equal('GPS' in result.values,false)
})
test('ambiguous EXIF blocks and JPEG segment/scan limits never become false missing EXIF',async()=>{
 const {bytes}=tiff(true)
 const duplicate=Buffer.concat([Buffer.from([255,216]),exifSegment(bytes),exifSegment(bytes),Buffer.from([255,218])])
 assert.equal((await inspect(duplicate)).result.container,'unreadable')
 const many=Buffer.concat([Buffer.from([255,216]),...Array.from({length:65},()=>Buffer.from([255,224,0,2])),Buffer.from([255,218])])
 assert.equal((await inspect(many)).result.container,'unreadable')
 const large=Buffer.concat([Buffer.from([255,216]),...Array.from({length:17},()=>Buffer.concat([Buffer.from([255,224,255,255]),Buffer.alloc(65533)])),Buffer.from([255,218])])
 const checked=await inspect(large);assert.equal(checked.result.container,'unreadable');assert.ok(checked.total<1024)
})
test('short reads, unavailable IO, invalid segment lengths and invalid input sizes yield closed unreadable results',async()=>{
 const bytes=fixture('normal')
 for(const read of [async()=>new Uint8Array(),async()=>{throw Error('/SYNTHETIC/PRIVATE/source.jpg')}]){
  const result=await readJpegExif(bytes.length,read);assert.equal(result.container,'unreadable')
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC'))
 }
 for(const bad of [Buffer.from([255,216,255,225,255,255]),Buffer.from([1,2,3,4])])
  assert.equal((await inspect(bad)).result.container,'unreadable')
 let called=false
 assert.equal((await readJpegExif(10*1024*1024+1,async()=>{called=true;return new Uint8Array()})).container,'unreadable')
 assert.equal(called,false)
})
test('exit checkpoints stop all subsequent IO; standalone projection rejects extra identity fields',async()=>{
 const bytes=fixture('normal');let alive=true,reads=0
 const result=await readJpegExif(bytes.length,async(position,length)=>{reads++;alive=false;return new Uint8Array(bytes.subarray(position,position+length))},()=>alive)
 assert.equal(reads,1);assert.equal(result.container,'unreadable')
 assert.equal(parseExifProjection({...cases.normal.exif,owner:'SYNTHETIC_PRIVATE'}),null)
})
