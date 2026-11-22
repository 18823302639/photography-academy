import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {photoCandidate,inspectLocalJpeg,pickerCancelled,PhotoInputError,PHOTO_MAX_BYTES,PHOTO_MAX_PIXELS,type LocalPhotoPort} from '../src/photo-input.ts'
const bytes=readFileSync(new URL('../../../tests/fixtures/photo-input/landscape.jpg',import.meta.url))
const c={path:'wxfile://tmp_synthetic.jpg',size:bytes.length}
const port=(overrides:Partial<LocalPhotoPort>={}):LocalPhotoPort=>({
 size:async()=>bytes.length,header:async()=>new Uint8Array(bytes.subarray(0,3)),
 imageInfo:async()=>({type:'jpeg',width:96,height:64}),...overrides
})
test('synthetic JPEG produces only transient preflight data; EXIF is not invented',async()=>{
 const p=await inspectLocalJpeg(c,port())
 assert.deepEqual(p,{version:1,source:'local_picker',path:c.path,bytes:bytes.length,width:96,height:64,format:'jpeg',exifStatus:'not_read',validation:'client_preflight_only'})
 for(const path of ['wxfile://tmp_synthetic.png','http://tmp/synthetic','https://tmp/synthetic'])
  assert.equal((await inspectLocalJpeg({...c,path},port())).format,'jpeg')
})
test('reject remote, malformed and unknown paths and invalid declared sizes before any IO',async()=>{
 for(const path of ['https://example.com/a.jpg','http://tmp.evil/a.jpg','http://tmp@evil/a.jpg','wxfile://tmp/../x','', 'file:///a.jpg','http://tmp/a?x=1'])
  assert.throws(()=>photoCandidate({tempFilePath:path,size:100}),PhotoInputError)
 for(const size of [0,2,-1,1.5,NaN,Infinity,PHOTO_MAX_BYTES+1,'100'])
  assert.throws(()=>photoCandidate({tempFilePath:c.path,size}),PhotoInputError)
 let called=false
 await assert.rejects(inspectLocalJpeg({...c,path:'https://example.com/a'},port({size:async()=>{called=true;return 100}})),PhotoInputError)
 assert.equal(called,false)
})
test('actual size is checked before header/decoder and must match the picker',async()=>{
 for(const size of [0,PHOTO_MAX_BYTES+1,bytes.length+1,NaN]){
  let called=false
  await assert.rejects(inspectLocalJpeg(c,port({size:async()=>size,header:async()=>{called=true;return new Uint8Array()}})),PhotoInputError)
  assert.equal(called,false)
 }
})
test('renamed PNG cannot pass JPEG signature; extension alone never grants acceptance',async()=>{
 const png=readFileSync(new URL('../../../tests/fixtures/photo-input/png-disguised.jpg',import.meta.url))
 let decoded=false
 await assert.rejects(inspectLocalJpeg({path:c.path,size:png.length},port({size:async()=>png.length,
  header:async()=>new Uint8Array(png.subarray(0,3)),imageInfo:async()=>{decoded=true;return {type:'jpeg',width:16,height:16}}})),PhotoInputError)
 assert.equal(decoded,false)
})
test('signature is insufficient: platform type, valid dimensions and pixel limit must pass',async()=>{
 for(const info of [{type:'png',width:96,height:64},{type:'jpeg',width:0,height:64},
  {type:'jpg',width:1.5,height:64},{type:'jpeg',width:NaN,height:64},
  {type:'jpeg',width:PHOTO_MAX_PIXELS+1,height:1}])
  await assert.rejects(inspectLocalJpeg(c,port({imageInfo:async()=>info})),PhotoInputError)
 const edge=await inspectLocalJpeg(c,port({imageInfo:async()=>({type:'jpg',width:8000,height:5000})}))
 assert.equal(edge.width*edge.height,PHOTO_MAX_PIXELS)
})
test('file or decoder failure propagates; truncated JPEG is never silently treated as a photo',async()=>{
 const truncated=readFileSync(new URL('../../../tests/fixtures/photo-input/truncated.jpg',import.meta.url))
 const broken={path:c.path,size:truncated.length}
 await assert.rejects(inspectLocalJpeg(broken,port({size:async()=>truncated.length,
  header:async()=>new Uint8Array(truncated.subarray(0,3)),imageInfo:async()=>{throw Error('decode failed')}})),/decode failed/)
 await assert.rejects(inspectLocalJpeg(c,port({header:async()=>{throw Error('read failed')}})),/read failed/)
})
test('exit checkpoints stop subsequent local IO and reject late results',async()=>{
 for(const stage of ['size','header','imageInfo'] as const){
  let alive=true;const calls:string[]=[];const base=port();const p={} as LocalPhotoPort
  for(const k of ['size','header','imageInfo'] as const)(p as any)[k]=async(path:string)=>{
   calls.push(k);const value=await base[k](path);if(k===stage)alive=false;return value
  }
  await assert.rejects(inspectLocalJpeg(c,p,()=>alive),PhotoInputError)
  assert.deepEqual(calls,['size','header','imageInfo'].slice(0,['size','header','imageInfo'].indexOf(stage)+1))
 }
})
test('only an explicit picker cancellation is shown as cancellation, never permission failure',()=>{
 assert.equal(pickerCancelled({errMsg:'chooseMedia:fail cancel'}),true)
 for(const e of [null,Error('cancel'),{errMsg:'chooseMedia:fail auth deny'},{errMsg:'readFile:fail cancel'}])assert.equal(pickerCancelled(e),false)
})
