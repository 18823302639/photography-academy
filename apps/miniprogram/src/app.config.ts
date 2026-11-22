export default defineAppConfig({
 pages:['pages/index/index','pages/photos/index','pages/records/index'],
 window:{navigationBarTitleText:'摄影练习',navigationBarBackgroundColor:'#f6f2e9',navigationBarTextStyle:'black',backgroundColor:'#f6f2e9'},
 tabBar:{color:'#59665f',selectedColor:'#24543f',backgroundColor:'#fffdf8',borderStyle:'white',list:[
  {pagePath:'pages/index/index',text:'练习',iconPath:'assets/tabs/practice.png',selectedIconPath:'assets/tabs/practice-on.png'},
  {pagePath:'pages/photos/index',text:'照片',iconPath:'assets/tabs/photos.png',selectedIconPath:'assets/tabs/photos-on.png'},
  {pagePath:'pages/records/index',text:'记录',iconPath:'assets/tabs/records.png',selectedIconPath:'assets/tabs/records-on.png'}
 ]}
})
