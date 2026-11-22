import Taro from '@tarojs/taro'
import type {LocalPhotoPort} from '../../../../../packages/photography-core/src/photo-input'
export type PhotoPhase='pick'|'candidate'|'size'|'signature'|'decode'|'exif'|'image'|'exit'
type State='begin'|'ok'|'unavailable'|'failed'|'threw'|'response_invalid'|'binary_invalid'|'length_invalid'|'range_invalid'|'validated'|'rejected'|'read'|'absent'|'unreadable'|'wait'|'loaded'|'cancel'
export type PhotoDiagnostic=`${PhotoPhase}.${State}`
type FilePhase='size'|'signature'|'exif'
type NativeApi=Pick<typeof Taro,'getFileSystemManager'|'getImageInfo'>
export class PhotoAdapterError extends Error {
 constructor(readonly code:PhotoDiagnostic){super(code)}
}

// Real callbacks remain native; only fixed, data-free codes cross this diagnostic boundary.
export function createLocalPhotoAdapter(api:NativeApi=Taro,notify:(code:PhotoDiagnostic)=>void=()=>{}){
 const emit=(code:PhotoDiagnostic)=>{try{notify(code)}catch{/* diagnostics cannot change validation */}}
 const fault=(phase:PhotoPhase,state:State)=>{const code:PhotoDiagnostic=`${phase}.${state}`;emit(code);return new PhotoAdapterError(code)}
 function manager(phase:FilePhase){
  if(typeof api.getFileSystemManager!=='function')throw fault(phase,'unavailable')
  try{return api.getFileSystemManager()}catch{throw fault(phase,'threw')}
 }
 function binary(data:unknown,length:number,phase:FilePhase):Uint8Array{
  let byteLength:number
  try {
   // Internal-slot brand check works across JS contexts and rejects toStringTag/byteLength spoofs.
   const getter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength')?.get
   if(!getter)throw Error('no buffer brand check')
   byteLength=getter.call(data)
  }catch{throw fault(phase,'binary_invalid')}
  if(byteLength!==length)throw fault(phase,'length_invalid')
  try{return new Uint8Array(new Uint8Array(data as ArrayBuffer))}catch{throw fault(phase,'binary_invalid')}
 }
 function fileCall<T>(phase:FilePhase,invoke:(fs:Taro.FileSystemManager,success:(result:any)=>void,fail:()=>void)=>void,parse:(result:any)=>T):Promise<T>{
  emit(`${phase}.begin`)
  return new Promise((resolve,reject)=>{
   let settled=false
   const rejectOnce=(e:PhotoAdapterError)=>{if(!settled){settled=true;reject(e)}}
   const failed=()=>{if(!settled)rejectOnce(fault(phase,'failed'))}
   try {
    const fs=manager(phase)
    invoke(fs,result=>{
     if(settled)return
     try{const value=parse(result);settled=true;emit(`${phase}.ok`);resolve(value)}
     catch(e){rejectOnce(e instanceof PhotoAdapterError?e:fault(phase,'response_invalid'))}
    },failed)
   }catch(e){if(!settled)rejectOnce(e instanceof PhotoAdapterError?e:fault(phase,'threw'))}
  })
 }
 function read(path:string,position:number,length:number,phase:'signature'|'exif'){
  if(!Number.isSafeInteger(position)||position<0||!Number.isSafeInteger(length)||length<1||length>65535)
   return Promise.reject(fault(phase,'range_invalid'))
  return fileCall(phase,(fs,success,fail)=>{
   if(!fs||typeof fs.readFile!=='function')throw fault(phase,'unavailable')
   fs.readFile({filePath:path,position,length,success,fail})
  },result=>binary(result?.data,length,phase))
 }
 const port:LocalPhotoPort={
  size:path=>fileCall('size',(fs,success,fail)=>{
   if(!fs||typeof fs.getFileInfo!=='function')throw fault('size','unavailable')
   fs.getFileInfo({filePath:path,success,fail})
  },result=>{
   if(!Number.isSafeInteger(result?.size)||result.size<0)throw fault('size','response_invalid')
   return result.size
  }),
  header:path=>read(path,0,3,'signature'),
  imageInfo:async path=>{
   emit('decode.begin')
   if(typeof api.getImageInfo!=='function')throw fault('decode','unavailable')
   let pending
   try{pending=api.getImageInfo({src:path})}catch{throw fault('decode','threw')}
   let result
   try{result=await pending}catch{throw fault('decode','failed')}
   if(!result||typeof result.type!=='string'||typeof result.width!=='number'||typeof result.height!=='number')
    throw fault('decode','response_invalid')
   emit('decode.ok')
   return {type:result.type,width:result.width,height:result.height}
  }
 }
 return {port,readRange:(path:string,position:number,length:number)=>read(path,position,length,'exif')}
}
const defaultAdapter=createLocalPhotoAdapter()
export const localPhotoPort=defaultAdapter.port
export const readLocalRange=defaultAdapter.readRange
