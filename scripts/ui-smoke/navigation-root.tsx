// Cached page host only for tests/visual review. The production app uses the native TabBar.
import {useEffect,useState} from 'react'
import Practice from '../../apps/miniprogram/src/pages/index/index'
import Photos from '../../apps/miniprogram/src/pages/photos/index'
import Records from '../../apps/miniprogram/src/pages/records/index'
import Taro,{PageScope,observeTestPage,testPage,showTestPage} from './taro'
const pages={practice:Practice,photos:Photos,records:Records}
const urls={practice:'/pages/index/index',photos:'/pages/photos/index',records:'/pages/records/index'}
export default function NavigationRoot(){
 const [route,setRoute]=useState(()=>testPage()==='test'?'practice':testPage())
 const [visited,setVisited]=useState<string[]>(()=>[testPage()==='test'?'practice':testPage()])
 useEffect(()=>{const stop=observeTestPage(next=>{setRoute(next);setVisited(v=>v.includes(next)?v:[...v,next])});showTestPage('practice');return stop},[])
 return <><main>{visited.map(key=>{const Page=pages[key as keyof typeof pages];return <div key={key} data-page={key} hidden={route!==key}><PageScope.Provider value={key}><Page/></PageScope.Provider></div>})}</main>
  <nav className='preview-nav'>{(['practice','photos','records'] as const).map((key,i)=><button key={key} onClick={()=>Taro.switchTab({url:urls[key]})} data-active={key===route}>导航：{['练习','照片','记录'][i]}</button>)}</nav>
 </>
}
