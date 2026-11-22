// T09 offline, transient input only. This is not a stored Photo or a server trust boundary.
export const PHOTO_MAX_BYTES=10*1024*1024
export const PHOTO_MAX_PIXELS=40_000_000
export interface LocalPhotoCandidate {path:string;size:number}
export interface LocalPhotoPreview {
 version:1;source:'local_picker';path:string;bytes:number;width:number;height:number
 format:'jpeg';exifStatus:'not_read';validation:'client_preflight_only'
}
export interface LocalPhotoPort {
 size(path:string):Promise<number>
 header(path:string):Promise<Uint8Array>
 imageInfo(path:string):Promise<{type:string;width:number;height:number}>
}
export class PhotoInputError extends Error {}
function checkSize(n:number){
 if(!Number.isSafeInteger(n)||n<3||n>PHOTO_MAX_BYTES)throw new PhotoInputError('仅接受不超过 10 MiB 的非空 JPEG。')
}
export function photoCandidate(raw:unknown):LocalPhotoCandidate {
 if(!raw||typeof raw!=='object')throw new PhotoInputError('未取得一张有效的本地图片。')
 const r=raw as Record<string,unknown>
 // Only picker temporary paths. In particular, never pass an arbitrary URL to getImageInfo.
 if(typeof r.tempFilePath!=='string'||r.tempFilePath.length>2048||
  !/^(?:wxfile:\/\/|https?:\/\/tmp\/)[A-Za-z0-9_./%-]+$/.test(r.tempFilePath)||
  r.tempFilePath.split('/').includes('..'))throw new PhotoInputError('暂不支持此本地临时路径；不会尝试网络下载。')
 if(typeof r.size!=='number')throw new PhotoInputError('无法确认文件字节数。')
 checkSize(r.size)
 return {path:r.tempFilePath,size:r.size}
}
export async function inspectLocalJpeg(candidate:LocalPhotoCandidate,port:LocalPhotoPort,isCurrent=()=>true):Promise<LocalPhotoPreview> {
 const checkpoint=()=>{if(!isCurrent())throw new PhotoInputError('此选图操作已退出。')}
 // Recheck even when callers construct their own candidate rather than using photoCandidate.
 const c=photoCandidate({tempFilePath:candidate.path,size:candidate.size})
 checkpoint()
 const size=await port.size(c.path)
 checkpoint()
 checkSize(size)
 if(size!==c.size)throw new PhotoInputError('文件大小已变化，请重新选择。')
 const header=await port.header(c.path)
 checkpoint()
 if(header.length!==3||header[0]!==255||header[1]!==216||header[2]!==255)
  throw new PhotoInputError('只接受 JPEG；文件扩展名不能作为格式依据。')
 const info=await port.imageInfo(c.path)
 checkpoint()
 if(typeof info.type!=='string'||!['jpeg','jpg'].includes(info.type.toLowerCase()))throw new PhotoInputError('平台识别的图片格式不是 JPEG。')
 if(!Number.isSafeInteger(info.width)||!Number.isSafeInteger(info.height)||info.width<1||info.height<1||
  info.width>PHOTO_MAX_PIXELS/info.height)throw new PhotoInputError('图片尺寸无效或超过 4000 万像素。')
 return {version:1,source:'local_picker',path:c.path,bytes:size,width:info.width,height:info.height,
  format:'jpeg',exifStatus:'not_read',validation:'client_preflight_only'}
}
export function pickerCancelled(error:unknown):boolean {
 if(!error||typeof error!=='object')return false
 const message=(error as {errMsg?:unknown}).errMsg
 return typeof message==='string'&&/^chooseMedia:fail cancel(?:\s|$)/i.test(message)
}
