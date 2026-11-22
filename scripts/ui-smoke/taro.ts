import {createContext,useContext,useEffect,useRef} from 'react'
export const useReady=(fn:()=>void)=>useEffect(fn,[])
export const PageScope=createContext('test')
let route='test'
const observers=new Set<(route:string)=>void>()
export const testPage=()=>route
export function observeTestPage(fn:(route:string)=>void){observers.add(fn);return()=>{observers.delete(fn)}}
let resolveImage=(path:string)=>path
export const previewImage=(path:string)=>resolveImage(path)
export function setPreviewImageResolver(fn:(path:string)=>string){resolveImage=fn}
const shown=new Map<string,Set<()=>void>>(),hidden=new Map<string,Set<()=>void>>()
function useLifecycle(map:Map<string,Set<()=>void>>,fn:()=>void,initial=false){
 const scope=useContext(PageScope),current=useRef(fn);current.current=fn
 useEffect(()=>{const handler=()=>current.current();const set=map.get(scope)||new Set();set.add(handler);map.set(scope,set)
  if(initial&&route===scope)handler()
  return()=>{set.delete(handler)}
 },[scope])
}
export const useDidShow=(fn:()=>void)=>useLifecycle(shown,fn,true)
export const useDidHide=(fn:()=>void)=>useLifecycle(hidden,fn)
export function showTestPage(next:string){if(next===route)return;hidden.get(route)?.forEach(fn=>fn());route=next;shown.get(route)?.forEach(fn=>fn());observers.forEach(fn=>fn(route))}
const Taro={
 nextTick:(fn:()=>void)=>queueMicrotask(fn),
 switchTab:async({url}:any)=>{showTestPage(url==='/pages/index/index'?'practice':url==='/pages/photos/index'?'photos':'records')},
 chooseMedia:async(_options:any):Promise<any>=>{throw {errMsg:'chooseMedia:fail unavailable in DOM adapter'}},
 getImageInfo:async(_options:any):Promise<any>=>{throw Error('getImageInfo unavailable in DOM adapter')},
 getFileSystemManager:()=>({
  getFileInfo:({fail}:any)=>fail({errMsg:'getFileInfo:fail unavailable in DOM adapter'}),
  readFile:({fail}:any)=>fail({errMsg:'readFile:fail unavailable in DOM adapter'})
 }),
 getStorageSync:(key:string)=>{const value=localStorage.getItem(key);return value===null?'':JSON.parse(value)},
 setStorageSync:(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value)),
 removeStorageSync:(key:string)=>localStorage.removeItem(key),
 pageScrollTo:async({selector}:any)=>{const target=document.querySelector(selector);if(!target)throw Error('target missing');target.scrollIntoView()},
 showModal:async({title,content}:any)=>({confirm:window.confirm(title+'\n'+content)}),
 createSelectorQuery:()=>({select:(selector:string)=>({fields:()=>({exec:(cb:any)=>{const node=document.querySelector(selector);cb(node?[{node,width:node.clientWidth}]:[])}})})})
}
export default Taro
