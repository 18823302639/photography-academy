import {useEffect,useState} from 'react'
import {useDidShow} from '@tarojs/taro'
import {View} from '@tarojs/components'
import LocalPhoto from '../index/local-photo'
import {showTab,currentTab,observeTab} from '../../navigation'
export default function Photos(){
 const [tab,setTab]=useState(currentTab)
 useEffect(()=>observeTab(setTab),[])
 useDidShow(()=>{showTab('photos');setTab('photos')})
 return <View className='page'>
  <View className='page-heading'><View className='title'>照片</View><View className='caption'>本机预览</View></View>
  <LocalPhoto visible={tab==='photos'}/>
 </View>
}
