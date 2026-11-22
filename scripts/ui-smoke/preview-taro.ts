// Browser-only synthetic-file bridge for visual review, never imported by the mini program.
import Taro,{setPreviewImageResolver} from './taro'
const files=new Map<string,{file:File;url:string}>();let number=0
setPreviewImageResolver(path=>files.get(path)?.url||path)
Taro.chooseMedia=async()=>new Promise((resolve,reject)=>{
 const input=document.createElement('input');input.type='file';input.accept='image/jpeg';input.id='synthetic-preview-file';document.body.appendChild(input)
 input.onchange=()=>{const file=input.files?.[0];if(!file){input.remove();reject({errMsg:'chooseMedia:fail cancel'});return}
  const path='http://tmp/synthetic-'+(++number)+'.jpg';files.set(path,{file,url:URL.createObjectURL(file)});input.remove();resolve({tempFiles:[{tempFilePath:path,size:file.size}]})}
 input.click()
})
Taro.getFileSystemManager=()=>({
 getFileInfo:({filePath,success,fail}:any)=>{const f=files.get(filePath);f?success({size:f.file.size}):fail({})},
 readFile:({filePath,position,length,success,fail}:any)=>{const f=files.get(filePath);if(!f){fail({});return}
  f.file.slice(position,position+length).arrayBuffer().then(data=>success({data}),()=>fail({}))}
})
Taro.getImageInfo=async({src}:any)=>new Promise((resolve,reject)=>{
 const f=files.get(src);if(!f){reject({});return}
 const image=new window.Image();image.onload=()=>resolve({type:'jpeg',width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject({});image.src=f.url
})
export default Taro
export {useReady,useDidShow,useDidHide} from './taro'
