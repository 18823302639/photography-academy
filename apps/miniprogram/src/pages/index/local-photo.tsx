import {useEffect,useRef,useState} from 'react'
import Taro from '@tarojs/taro'
import {View,Text,Button,Image} from '@tarojs/components'
import {inspectLocalJpeg,photoCandidate,PhotoInputError,pickerCancelled,type LocalPhotoPreview} from '../../../../../packages/photography-core/src/photo-input'
import {createLocalPhotoAdapter,PhotoAdapterError,type PhotoDiagnostic,type PhotoPhase} from './local-photo-port'
import {readJpegExif} from '../../../../../packages/photography-core/src/local-exif'
import type {ExifProjection,FieldName} from '../../../../../packages/photography-core/src/photo-processing'

interface Slot {id:number;photo:LocalPhotoPreview;exif:ExifProjection}
const fields:Array<[FieldName,string,string]>=[['exposure_seconds','快门',' 秒'],['f_number','光圈',''],['iso','ISO',''],['focal_length_mm','焦距',' mm'],['orientation','方向标签','']]
const states={missing:'缺失',invalid:'无效或超出协议范围',unreadable:'无法可靠读取'}
const groups=[{title:'曝光参数',fields:fields.slice(0,3)},{title:'镜头与方向',fields:fields.slice(3)}]
export default function LocalPhoto({visible=true}:{visible?:boolean}){
 const [photo,setPhoto]=useState<Slot|null>(null)
 const [pending,setPending]=useState<Slot|null>(null)
 const [busy,setBusy]=useState(false)
 const [trace,setTrace]=useState<PhotoDiagnostic[]>([])
 const [details,setDetails]=useState(false)
 const [status,setStatus]=useState('尚未选择图片。请用交付包内的合成 JPEG 测试。')
 const [notice,setNotice]=useState<'empty'|'loading'|'ready'|'cancelled'|'error'|'exited'|'paused'>('empty')
 const epoch=useRef(0),active=useRef(true),inFlight=useRef(false)
 const displayed=useRef<Slot|null>(null)
 const visibleRef=useRef(visible);visibleRef.current=visible
 useEffect(()=>{active.current=true;return()=>{active.current=false;epoch.current++}},[])
 useEffect(()=>{
  if(visible)return
  epoch.current++;inFlight.current=false;setPending(null);setBusy(false)
  setNotice('paused')
  setStatus('已切换栏目：未完成的选择已取消，已载入预览仅暂存本次内存。')
 },[visible])
 const current=(id:number)=>active.current&&visibleRef.current&&epoch.current===id
 async function choose(){
  if(!visibleRef.current||inFlight.current)return
  const id=++epoch.current
  let phase:PhotoPhase='pick'
  const record=(code:PhotoDiagnostic)=>{
   if(!current(id))return
   phase=code.split('.')[0] as PhotoPhase
   setTrace(t=>t.includes(code)?t:[...t.slice(-23),code])
  }
  const adapter=createLocalPhotoAdapter(Taro,record)
  setTrace([]);setDetails(false);record('pick.begin')
  inFlight.current=true;setBusy(true);setPending(null);setStatus('正在选择并检查本地文件……')
  setNotice('loading')
  try{
   const result=await Taro.chooseMedia({count:1,mediaType:['image'],sourceType:['album'],sizeType:['original']})
   if(!current(id))return
   record('pick.ok');record('candidate.begin')
   if(result.tempFiles.length!==1)throw new PhotoInputError('每次请选择一张 JPEG。')
   const value=await inspectLocalJpeg(photoCandidate(result.tempFiles[0]),adapter.port,()=>current(id))
   if(!current(id))return
   record('decode.validated');record('exif.begin')
   const exif=await readJpegExif(value.bytes,(position,length)=>adapter.readRange(value.path,position,length),()=>current(id))
   if(!current(id))return
   if(exif.container==='unreadable')setDetails(true)
   record(`exif.${exif.container}`);record('image.wait')
   setPending({id,photo:value,exif});setStatus('初检通过，等待图片组件载入；原预览保留至成功。')
  }catch(e){
   if(!current(id))return
   inFlight.current=false;setBusy(false)
   const cancelled=pickerCancelled(e)
   setNotice(cancelled?'cancelled':'error')
   if(!cancelled)setDetails(true)
   record(cancelled?'pick.cancel':e instanceof PhotoInputError?`${phase}.rejected`:e instanceof PhotoAdapterError?e.code:`${phase}.failed`)
   setStatus(cancelled?'已取消选择，原预览保持。':e instanceof PhotoInputError?e.message+' 原预览保持。':`本地文件读取或图片信息检查失败（阶段 ${phase}），请重新选择。原预览保持。`)
  }
 }
 function accept(slot:Slot){
  if(!current(slot.id))return
  setTrace(t=>[...t.slice(-23),'image.loaded'])
  displayed.current=slot;setPhoto(slot);setPending(null);inFlight.current=false;setBusy(false);setStatus('离线预览已载入。没有上传、保存照片或生成点评。')
  setNotice('ready')
 }
 function reject(slot:Slot){
  if(!current(slot.id))return
  setTrace(t=>[...t.slice(-23),'image.failed'])
  setPending(null);inFlight.current=false;setBusy(false);setStatus('图片组件无法载入此文件。原预览保持，请重新选择。')
  setDetails(true)
  setNotice('error')
 }
 function leave(){
  epoch.current++;inFlight.current=false;displayed.current=null;setPending(null);setPhoto(null);setBusy(false)
  setTrace(['exit.ok'])
  setNotice('exited')
  setStatus('已退出预览并清除本页引用。未删除相册原件；平台临时文件由微信管理。')
 }
 const noticeTitles={empty:'从一张 JPG 开始',loading:photo?'正在检查替换照片…':'正在读取照片…',ready:photo?.exif.container==='absent'?'预览已就绪 · 无 EXIF':'预览已就绪',cancelled:photo?'已取消替换，原图保留':'已取消选择',error:photo?'替换未完成，原图保留':'照片未载入，请重新选择',exited:'预览已清空',paused:photo?'已返回本次预览':'选择照片即可开始'}
 return <View className='photo-sheet' id='local-photo-input'>
  <View className='privacy-line'>仅在本机读取，不上传／不做 AI 点评</View>
  <View className='photo-actions'>
   <Button className={photo?'secondary':'primary-action'} onClick={choose} disabled={busy||!visible}>{photo?'更换照片':'选择照片'}</Button>
   {(photo||pending||busy)&&<Button className='text-action' onClick={leave}>退出并清除预览</Button>}
  </View>
  {!photo&&!pending&&<View className='photo-empty'><View className='empty-frame'><View className='empty-lens'/></View><View className='label'>选择一张 JPG，看看拍摄参数</View><View className='caption'>一次一张 · 最大 10 MiB / 4000 万像素</View><View className='caption'>测试请使用包内合成图</View></View>}
  <View className={photo||pending?'photo-viewport':''}>
  {[photo,pending].filter((slot):slot is Slot=>slot!==null).map(slot=><View className={pending?.id===slot.id&&photo?'preview-slot candidate-slot':'preview-slot'} key={slot.id}>
   <View className={pending?.id===slot.id?'note':'label'}>{pending?.id===slot.id?'候选图载入中；可随时退出。':'当前离线预览'}</View>
   <Image ariaLabel='所选 JPEG 的本机预览，未上传' className='local-photo-preview' src={slot.photo.path} mode='aspectFit' onLoad={()=>{
    if(pending?.id===slot.id)accept(slot)
   }} onError={()=>{
    if(pending?.id===slot.id){reject(slot);return}
    // An old Image event cannot remove a replacement or revive an exited preview.
    if(!active.current||displayed.current?.id!==slot.id)return
    displayed.current=null;setPhoto(null)
    if(!inFlight.current){setStatus('当前预览载入失败，请重新选择。没有提交照片。');setTrace(['image.failed']);setNotice('error')}
   }}/>
   {pending?.id!==slot.id&&<View className='caption'>JPEG · {slot.photo.width} × {slot.photo.height} · {slot.photo.bytes} 字节（平台报告，未计旋转）</View>}
  </View>)}
  </View>
  <View className={'photo-notice notice-'+notice}><View className='notice-title'>{noticeTitles[notice]}</View><View className='caption' id='local-photo-status'>{status}</View></View>
  {photo&&<View className='local-exif'>
   <View className='label'>拍摄参数</View><View className='caption'>EXIF 白名单 · 输入记录，未经真实性验证</View>
   {groups.map((group,i)=><View className={'parameter-group'+(i===0?' exposure-group':'')} key={group.title}><View className='parameter-heading'>{group.title}</View>
    {group.fields.map(([key,label,unit])=><View className='parameter-row' key={key}><Text>{label}：</Text><Text className='parameter-value'>{photo.exif.states[key]==='available'?(key==='f_number'?'f/':'')+String(photo.exif.values[key])+unit:states[photo.exif.states[key] as keyof typeof states]}</Text></View>)}
   </View>)}
   <View className='note'>{photo.exif.container==='absent'?'当前输入 JPEG 未发现 EXIF 块。':photo.exif.container==='unreadable'?'EXIF 无法可靠读取（格式、读取能力或保护上限），不按缺失处理。':'仅解释白名单字段；无效值不会被猜测或补齐。'}</View>
  </View>}
  <View className='caption'>切换底部栏目暂存已载入预览；退出预览或页面重新启动后需重选。后台可能保留页面缓存，不等于真正退出。</View>
  <Button className='text-action' onClick={()=>setDetails(v=>!v)}>{details?'收起读取状态与说明':'查看读取状态与说明'}</Button>
  <View hidden={!details}>
   <View className='note' id='local-photo-diagnostic'>阶段诊断（仅固定代码，不含路径或原始错误）：{trace.length?trace.join(' → '):'尚未开始'}</View>
   <View className='caption'>只读取微信交给本页的 JPEG，选图可能已改变元数据。结构化 EXIF 过滤不清除原 JPEG 字节；本页没有生成脱敏派生图、没有自行校正方向或色彩，显示方向由微信处理。客户端初检与载入不替代服务端校验。预览和参数不写入本机存储，临时文件由微信管理。</View>
  </View>
 </View>
}
