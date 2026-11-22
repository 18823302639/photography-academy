// Closed wire contract. The projection alone can be read locally; derived claims need real processing.
export type FieldName='exposure_seconds'|'f_number'|'iso'|'focal_length_mm'|'orientation'
type FieldState='available'|'missing'|'invalid'|'unreadable'
type Size={readonly width:number;readonly height:number}
type ImageInfo={readonly format:'jpeg';readonly bytes:number;readonly size:Size}
export type PhotoFailureCode='invalid_input_type'|'bytes_limit'|'unsupported_format'|'pixel_limit'|'decode_failed'|'processing_failed'
export interface PhotoProcessingFailure {readonly schema_version:'1.0';readonly status:'rejected';readonly code:PhotoFailureCode}
export interface ExifProjection {
 readonly source:'input_exif_not_verified';readonly container:'absent'|'read'|'unreadable'
 readonly values:Readonly<Record<FieldName,number|null>>;readonly states:Readonly<Record<FieldName,FieldState>>
}
export interface PhotoProcessingReport {
 readonly schema_version:'1.0';readonly status:'processed';readonly projection_policy:'allowlist_only';readonly original_bytes:'unchanged'
 readonly input:ImageInfo
 readonly exif:ExifProjection
 readonly derived:ImageInfo&{readonly metadata:'fresh_pixels_no_source_metadata';readonly pixel_content:'not_anonymized';
  readonly color:'no_icc_transform';readonly orientation:'applied'|'normal'|'not_present'|'invalid'|'unreadable'}
}
export type PhotoProcessingOutcome=PhotoProcessingReport|PhotoProcessingFailure
const fields:FieldName[]=['exposure_seconds','f_number','iso','focal_length_mm','orientation']
const limits:Record<FieldName,number>={exposure_seconds:86400,f_number:256,iso:10_000_000,focal_length_mm:100_000,orientation:8}
const failureCodes:PhotoFailureCode[]=['invalid_input_type','bytes_limit','unsupported_format','pixel_limit','decode_failed','processing_failed']
function record(raw:unknown,keys:string[]):Record<string,unknown>|null {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
 const proto=Object.getPrototypeOf(raw)
 if((proto!==Object.prototype&&proto!==null)||Object.getOwnPropertySymbols(raw).length||
  Object.getOwnPropertyNames(raw).sort().join('|')!==[...keys].sort().join('|'))return null
 const copy:Record<string,unknown>={}
 for(const key of keys){
  const descriptor=Object.getOwnPropertyDescriptor(raw,key)
  if(!descriptor||!('value' in descriptor))return null // No getters or retained raw object.
  copy[key]=descriptor.value
 }
 return copy
}
function positiveInt(value:unknown,max:number):value is number {
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=max
}
function size(raw:unknown):Size|null {
 const s=record(raw,['width','height'])
 return s&&positiveInt(s.width,40_000_000)&&positiveInt(s.height,40_000_000)&&s.width<=40_000_000/s.height?
  {width:s.width,height:s.height}:null
}
function image(raw:unknown,derived=false):Record<string,unknown>|null {
 const keys=['format','bytes','size',...(derived?['metadata','pixel_content','color','orientation']:[])]
 const r=record(raw,keys),pixels=r&&size(r.size)
 if(!r||!pixels||r.format!=='jpeg'||!positiveInt(r.bytes,10*1024*1024))return null
 return {...r,size:pixels}
}
export function validCaptureValue(field:FieldName,value:unknown):value is number {
 return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=limits[field]&&
  ((field!=='iso'&&field!=='orientation')||Number.isSafeInteger(value))
}
export function parseExifProjection(raw:unknown):ExifProjection|null {
 try {
  const exif=record(raw,['source','container','values','states'])
  if(!exif||exif.source!=='input_exif_not_verified'||!['absent','read','unreadable'].includes(exif.container as string))return null
  const values=record(exif.values,fields),states=record(exif.states,fields)
  if(!values||!states)return null
  for(const field of fields){
   const value=values[field],state=states[field]
   if(!['available','missing','invalid','unreadable'].includes(state as string)||(state==='available')!==(value!==null))return null
   if(exif.container==='absent'&&state!=='missing'||exif.container==='unreadable'&&state!=='unreadable'||exif.container==='read'&&state==='unreadable')return null
   if(value!==null&&!validCaptureValue(field,value))return null
  }
  return {...exif,values,states} as unknown as ExifProjection
 }catch{return null}
}
export function parsePhotoProcessingOutcome(raw:unknown):PhotoProcessingOutcome|null {
 try {
  const failure=record(raw,['schema_version','status','code'])
  if(failure)return failure.schema_version==='1.0'&&failure.status==='rejected'&&failureCodes.includes(failure.code as PhotoFailureCode)?
   {schema_version:'1.0',status:'rejected',code:failure.code as PhotoFailureCode}:null
  const r=record(raw,['schema_version','status','projection_policy','original_bytes','input','exif','derived'])
  if(!r||r.schema_version!=='1.0'||r.status!=='processed'||r.projection_policy!=='allowlist_only'||r.original_bytes!=='unchanged')return null
  const input=image(r.input),derived=image(r.derived,true),exif=parseExifProjection(r.exif)
  if(!input||!derived||!exif)return null
  const {values,states}=exif
  const state=states.orientation,orientation=values.orientation
  const expected=state==='available'?(orientation===1?'normal':'applied'):state==='missing'?'not_present':state
  if(derived.metadata!=='fresh_pixels_no_source_metadata'||derived.pixel_content!=='not_anonymized'||derived.color!=='no_icc_transform'||derived.orientation!==expected)return null
  let {width,height}=input.size as Size
  if([5,6,7,8].includes(orientation as number))[width,height]=[height,width]
  const d=derived.size as Size
  if(d.width>Math.min(width,1600)||d.height>Math.min(height,1600))return null
  // Every object below is a new, closed snapshot, without the caller's metadata or references.
  return {...r,input,exif:{...exif,values,states},derived} as unknown as PhotoProcessingReport
 }catch{return null}
}
