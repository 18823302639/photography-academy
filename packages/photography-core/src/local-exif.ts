// Bounded, read-only classic TIFF/EXIF subset. No Python, metadata strings, GPS traversal or file writes.
import {parseExifProjection,validCaptureValue,type ExifProjection,type FieldName} from './photo-processing.ts'
export type ReadRange=(position:number,length:number)=>Promise<Uint8Array>
export const EXIF_READ_LIMIT=96*1024
export const EXIF_SCAN_LIMIT=1024*1024
export const EXIF_SEGMENT_LIMIT=64
const tags=new Map<number,FieldName>([[33434,'exposure_seconds'],[33437,'f_number'],[34855,'iso'],[37386,'focal_length_mm'],[274,'orientation']])
export function emptyExif(container:'absent'|'unreadable'):ExifProjection {
 const state=container==='absent'?'missing':'unreadable'
 // Fallback must remain usable even if optional parsing/runtime capabilities fail.
 return {source:'input_exif_not_verified',container,
  values:{exposure_seconds:null,f_number:null,iso:null,focal_length_mm:null,orientation:null},
  states:{exposure_seconds:state,f_number:state,iso:state,focal_length_mm:state,orientation:state}}
}
function tiffProjection(bytes:Uint8Array):ExifProjection {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 const little=bytes[0]===73&&bytes[1]===73
 if(!little&&!(bytes[0]===77&&bytes[1]===77))throw Error('TIFF byte order')
 const check=(offset:number,length:number)=>{if(!Number.isSafeInteger(offset)||offset<0||offset+length>bytes.length)throw Error('TIFF bounds')}
 const u16=(offset:number)=>{check(offset,2);return view.getUint16(offset,little)}
 const u32=(offset:number)=>{check(offset,4);return view.getUint32(offset,little)}
 if(u16(2)!==42)throw Error('Only classic TIFF')
 const ifds:number[]=[];const ranges:Array<[number,number]>=[]
 type Entry={type:number;count:number;at:number}
 function table(offset:number):Map<number,Entry>{
  if(offset<8||ifds.includes(offset))throw Error('IFD cycle')
  ifds.push(offset)
  const count=u16(offset)
  if(count>256)throw Error('IFD entry limit')
  const end=offset+2+12*count+4;check(offset,end-offset)
  if(ranges.some(([start,stop])=>offset<stop&&end>start))throw Error('IFD overlap')
  ranges.push([offset,end])
  const result=new Map<number,Entry>()
  for(let i=0;i<count;i++){
   const at=offset+2+12*i,tag=u16(at)
   // Never dereference or decode unknown fields (including GPS/MakerNote/thumbnail).
   if(!tags.has(tag)&&tag!==34665)continue
   if(result.has(tag))throw Error('Ambiguous duplicate tag')
   result.set(tag,{type:u16(at+2),count:u32(at+4),at:at+8})
  }
  return result
 }
 const root=table(u32(4));let nested=new Map<number,Entry>()
 const pointer=root.get(34665)
 if(pointer){
  if(pointer.type!==4||pointer.count!==1)throw Error('Invalid EXIF IFD pointer')
  nested=table(u32(pointer.at))
  if(nested.has(34665))throw Error('Nested EXIF pointer unsupported')
 }
 const values:Record<string,number|null>={},states:Record<string,string>={}
 for(const [tag,name] of tags){
  const entry=tag!==274&&nested.has(tag)?nested.get(tag):root.get(tag)
  values[name]=null;states[name]='missing'
  if(!entry)continue
  states[name]='invalid'
  const scalar=(name==='iso'||name==='orientation')
  if(entry.count!==1||(!scalar&&entry.type!==5)||
   (name==='orientation'&&entry.type!==3)||(name==='iso'&&![3,4].includes(entry.type)))continue
  let value:number
  if(scalar)value=entry.type===3?u16(entry.at):u32(entry.at)
  else {
   const at=u32(entry.at);check(at,8)
   const denominator=u32(at+4)
   if(denominator===0)continue
   value=u32(at)/denominator
  }
  if(validCaptureValue(name,value)){values[name]=value;states[name]='available'}
 }
 const projection=parseExifProjection({source:'input_exif_not_verified',container:'read',values,states})
 if(!projection)throw Error('Invalid projection')
 return projection
}
export async function readJpegExif(size:number,read:ReadRange,isCurrent=()=>true):Promise<ExifProjection> {
 let consumed=0
 const checkpoint=()=>{if(!isCurrent())throw Error('aborted')}
 async function take(position:number,length:number){
  checkpoint()
  if(!Number.isSafeInteger(position)||!Number.isSafeInteger(length)||position<0||length<1||position+length>size||
   consumed+length>EXIF_READ_LIMIT)throw Error('JPEG read bounds')
  consumed+=length
  const data=await read(position,length)
  checkpoint()
  if(!(data instanceof Uint8Array)||data.length!==length)throw Error('Short binary read')
  return data
 }
 try {
  if(!Number.isSafeInteger(size)||size<4||size>10*1024*1024)throw Error('Input bounds')
  const soi=await take(0,2)
  if(soi[0]!==255||soi[1]!==216)throw Error('JPEG signature')
  let position=2,payload:Uint8Array|null=null
  for(let count=0;count<EXIF_SEGMENT_LIMIT;count++){
   if(position>EXIF_SCAN_LIMIT)throw Error('JPEG scan limit')
   const marker=await take(position,2)
   if(marker[0]!==255||marker[1]===0||marker[1]===216)throw Error('JPEG marker')
   if(marker[1]===255){position++;continue}
   if(marker[1]===218||marker[1]===217)return payload?tiffProjection(payload):emptyExif('absent')
   if(marker[1]===1||(marker[1]>=208&&marker[1]<=215)){position+=2;continue}
   const lengthBytes=await take(position+2,2),length=lengthBytes[0]*256+lengthBytes[1]
   if(length<2||position+2+length>size)throw Error('JPEG segment length')
   if(marker[1]===225&&length>=8){
    const prefix=await take(position+4,6)
    if(prefix[0]===69&&prefix[1]===120&&prefix[2]===105&&prefix[3]===102&&prefix[4]===0&&prefix[5]===0){
     if(payload)throw Error('Ambiguous EXIF blocks')
     payload=await take(position+10,length-8)
    }
   }
   position+=2+length
  }
  throw Error('JPEG segment limit')
 }catch{
  // Abort results are ignored by the operation owner, and checkpoints prevent more IO.
  return emptyExif('unreadable')
 }
}
