// Explicit cached native-page model in DOM, not an actual WeChat TabBar/runtime.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');fs.mkdirSync(out,{recursive:true});
const dom=new JSDOM('<div id="root"></div>',{url:'https://navigation-test.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
global.defineAppConfig=x=>x;dom.window.Element.prototype.scrollIntoView=function(){};
dom.window.HTMLCanvasElement.prototype.getContext=()=>{throw Error('No DOM canvas')};
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
esbuild.buildSync({stdin:{contents:'export {default as Root} from '+JSON.stringify(path.join(__dirname,'navigation-root.tsx'))+';'+
 'export {default as Taro,showTestPage} from '+JSON.stringify(path.join(__dirname,'taro.ts'))+';'+
 'export {default as config} from '+JSON.stringify(path.join(root,'apps/miniprogram/src/app.config.ts'))+';',resolveDir:root},
 bundle:true,outfile:path.join(out,'navigation-test.cjs'),platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],
 alias:{'@tarojs/taro':path.join(__dirname,'taro.ts'),'@tarojs/components':path.join(__dirname,'components.tsx')}});
const api=require(path.join(out,'navigation-test.cjs'));let app;
let writes=0,readCalls=0,chooseCalls=0,pick='normal',hold=null;
const write=api.Taro.setStorageSync;api.Taro.setStorageSync=(key,value)=>{writes++;write(key,value)};
const files=new Map(['normal','no_exif'].map(name=>['http://tmp/'+name+'.jpg',fs.readFileSync(path.join(root,'tests/fixtures/exif-contract',name+'.jpg'))]));
api.Taro.chooseMedia=async()=>{chooseCalls++;const filePath='http://tmp/'+pick+'.jpg';return {tempFiles:[{tempFilePath:filePath,size:files.get(filePath).length}]}};
function binary(o){const b=files.get(o.filePath).subarray(o.position,o.position+o.length);o.success({data:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)})}
api.Taro.getFileSystemManager=()=>({getFileInfo:o=>o.success({size:files.get(o.filePath).length}),readFile:o=>{
 readCalls++;if(hold&&o.length!==3){hold(o);return}binary(o)
}});
api.Taro.getImageInfo=async()=>({type:'jpeg',width:96,height:64});
const page=()=>document.querySelector('[data-page]:not([hidden])');
const visible=e=>!e.closest('[hidden]');
function button(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label&&visible(b));assert.ok(b,'visible button '+label);return b}
async function click(label){const b=button(label);assert.equal(b.disabled,false);await act(async()=>b.click())}
const form=()=>page().querySelector('#task-records');
async function input(index,value){const e=form().querySelectorAll('textarea')[index];assert.ok(e&&!e.disabled);await act(async()=>{
 Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(e,value);e.dispatchEvent(new window.Event('input',{bubbles:true}))
})}
async function load(){const e=page().querySelector('img');assert.ok(e);await act(async()=>e.dispatchEvent(new window.Event('load')))}
const params=()=>page().querySelector('.local-exif')?.textContent||'';
const loopKey='photography-academy:learning-loop:v1',profileKey='photography-academy:device-profile:v1';
async function mount(){await act(async()=>{api.showTestPage('practice');app=createRoot(document.getElementById('root'));app.render(React.createElement(api.Root))})}
async function unmount(){await act(async()=>app.unmount())}
(async()=>{
 assert.deepEqual(api.config.tabBar.list.map(t=>t.text),['练习','照片','记录']);assert.notEqual(api.config.tabBar.custom,true);
 assert.deepEqual(api.config.pages,api.config.tabBar.list.map(t=>t.pagePath));
 for(const t of api.config.tabBar.list)for(const file of [t.iconPath,t.selectedIconPath]){
  const b=fs.readFileSync(path.join(root,'apps/miniprogram/src',file));assert.equal(b.readUInt32BE(16),64);assert.equal(b.readUInt32BE(20),64);assert.ok(b.length<40000)
 }
 await mount();assert.equal(page().dataset.page,'practice');assert.ok(page().textContent.includes('下一步：'));
 assert.ok(button('开始第一轮记录'));assert.ok(![...page().querySelectorAll('button')].some(b=>b.textContent==='选择照片'&&visible(b)));
 assert.equal(writes,0);await click('导航：记录');assert.equal(page().querySelectorAll('textarea').length,0);assert.equal(writes,0);
 await click('导航：练习');
 console.log('PASS native route/config/icon integrity, direct practice action, isolated photo and empty read-only records');
 await input(0,'合成联调意图，未实拍');await input(1,'测试条件');await input(2,'测试观察');
 assert.equal(writes,3);const draft=localStorage.getItem(loopKey),editor=form().querySelector('textarea');
 assert.equal(button('继续第一轮记录').textContent,'继续第一轮记录');
 assert.ok(page().querySelector('.practice-stage').textContent.includes('第一轮草稿'));
 await click('导航：照片');assert.equal(button('选择照片').disabled,false);
 assert.ok(page().querySelector('.photo-empty').textContent.includes('JPG'));
 await click('选择照片');assert.ok(page().querySelector('.photo-notice').classList.contains('notice-loading'));
 await load();assert.ok(params().includes('ISO：200'));
 assert.equal(page().querySelectorAll('.parameter-group').length,2);
 const chosen=api.Taro.chooseMedia,src=page().querySelector('img').getAttribute('src');
 api.Taro.chooseMedia=async()=>{throw {errMsg:'chooseMedia:fail cancel'}};
 await click('更换照片');assert.ok(page().querySelector('.photo-notice').classList.contains('notice-cancelled'));
 assert.equal(page().querySelector('img').getAttribute('src'),src);assert.ok(params().includes('ISO：200'));api.Taro.chooseMedia=chosen;
 console.log('PASS photo empty/loading/parameter groups and explicit replacement cancellation preserve original image and EXIF');
 await click('导航：记录');const before=writes;assert.ok(page().textContent.includes('合成联调意图'));
 assert.ok(page().querySelector('.record-summary').textContent.includes('有未提交草稿'));
 assert.ok(page().querySelector('.record-summary .primary-action'));
 assert.equal(page().querySelectorAll('textarea').length,0);assert.equal(writes,before);assert.equal(localStorage.getItem(loopKey),draft);
 await click('导航：练习');assert.equal(form().querySelector('textarea'),editor);assert.equal(editor.value,'合成联调意图，未实拍');
 assert.equal(localStorage.getItem(loopKey),draft);
 console.log('PASS cached tab switch preserves draft/editor, photo read does not write records, records remain read-only');
 const calls=chooseCalls,reads=readCalls;await click('导航：照片');assert.ok(params().includes('ISO：200'));
 assert.ok(button('更换照片'));assert.equal(chooseCalls,calls);assert.equal(readCalls,reads);
 await click('导航：练习');await click('保存第一轮并查看 Mock 点评');
 assert.equal(page().querySelector('.primary-action').textContent,'继续复拍记录');
 const first=JSON.stringify(JSON.parse(localStorage.getItem(loopKey)).first);
 await click('导航：记录');const noWrite=writes;assert.ok(page().textContent.includes('第一轮已保存'));
 await click('继续这项练习');assert.equal(page().dataset.page,'practice');assert.equal(writes,noWrite);
 await input(0,'复拍合成意图');await input(1,'合成变化');await input(2,'合成观察');await input(3,'合成反思');await click('保存复拍与对比');
 const saved=JSON.parse(localStorage.getItem(loopKey));assert.equal(JSON.stringify(saved.first),first);assert.ok(saved.retake);
 assert.equal(page().querySelector('.primary-action').textContent,'查看两轮记录');
 await click('导航：记录');assert.ok(page().textContent.includes('两轮与对比已保存'));
 assert.equal(page().querySelector('.record-summary .primary-action').textContent,'查看两轮记录');
 console.log('PASS returning photo preserves memory-only preview; record resume uses one editor and preserves immutable first/retake history');
 await click('导航：练习');await click('设备与任务');await click('选择 R7');await click('ML100 常亮灯');await click('手动快门与 ISO：未确认（点此切换）');
 const profile=localStorage.getItem(profileKey);await click('查看凝固/模糊任务与记录');await input(0,'旧草稿');
 let finish;api.Taro.showModal=()=>new Promise(resolve=>{finish=resolve});await click('放弃当前草稿…');
 await click('导航：记录');await click('凝固/模糊任务');const readonlyWrites=writes;await click('继续这项练习');assert.equal(writes,readonlyWrites);
 await input(0,'切回后新草稿');const motionKey=loopKey+':shutter-motion-v1',motion=localStorage.getItem(motionKey);
 await act(async()=>finish({confirm:true}));assert.equal(localStorage.getItem(motionKey),motion);assert.equal(form().querySelector('textarea').value,'切回后新草稿');
 assert.equal(localStorage.getItem(profileKey),profile);assert.equal(JSON.stringify(JSON.parse(localStorage.getItem(loopKey)).first),first);
 console.log('PASS device/profile persistence and cached-page hide invalidate late cancel without erasing a newer draft or history');
 const writer=api.Taro.setStorageSync;api.Taro.setStorageSync=()=>{throw Error('synthetic quota')};
 await input(0,'写失败但仍在内存的合成草稿');assert.equal(localStorage.getItem(motionKey),motion);
 await click('导航：记录');assert.ok(page().textContent.includes('切回后新草稿'));assert.ok(!page().textContent.includes('写失败但仍在内存'));
 await click('继续这项练习');assert.equal(form().querySelector('textarea').value,'写失败但仍在内存的合成草稿');
 api.Taro.setStorageSync=writer;const retryWrites=writes;await click('重试保存草稿');assert.equal(writes,retryWrites+1);
 console.log('PASS failed-storage draft survives cached navigation; read-only records show durable data and retry writes exactly once');
 await click('导航：照片');let oldRead;hold=o=>{oldRead=o};pick='normal';await click('更换照片');assert.ok(oldRead);
 await click('导航：练习');hold=null;await click('导航：照片');assert.ok(params().includes('ISO：200'));
 pick='no_exif';await click('更换照片');const candidates=page().querySelectorAll('img');await act(async()=>candidates[candidates.length-1].dispatchEvent(new window.Event('load')));
 assert.ok(params().includes('ISO：缺失'));const afterReads=readCalls;
 await act(async()=>binary(oldRead));assert.equal(readCalls,afterReads);assert.ok(params().includes('ISO：缺失'));
 await click('退出并清除预览');assert.equal(params(),'');assert.equal(page().querySelectorAll('img').length,0);
 await click('导航：记录');await click('导航：照片');assert.ok(button('选择照片'));assert.equal(params(),'');
 console.log('PASS tab hide cancels pending selection; late EXIF cannot replace a new preview; explicit exit clears photo and parameters');
 pick='normal';await click('选择照片');await load();assert.ok(params().includes('ISO：200'));
 const disk=[...Array(localStorage.length)].map((_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]);
 assert.ok(disk.every(([key,value])=>!String(value).includes('http://tmp/')&&[profileKey,loopKey,motionKey].includes(key)));
 await unmount();await mount();await click('导航：照片');assert.ok(button('选择照片'));assert.equal(params(),'');
 assert.deepEqual([...Array(localStorage.length)].map((_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]),disk);
 await click('导航：练习');await click('设备与任务');assert.ok(page().textContent.includes('当前设备：R7'));await click('练习记录');
 assert.ok(form().textContent.includes('已记录复拍对比'));
 console.log('PASS actual page-root reconstruction starts photo empty and restores original device/two-round storage without new keys');
 const badKey=loopKey+':exposure-compensation-v1',bad='{"version":999}';localStorage.setItem(badKey,bad);
 const w=writes;await click('导航：记录');await click('曝光补偿任务');assert.ok(page().textContent.includes('暂无法读取'));assert.equal(localStorage.getItem(badKey),bad);assert.equal(writes,w);
 console.log('PASS corrupt historical data stays untouched in read-only records');
 await unmount();localStorage.clear();
 localStorage.setItem('photography-academy:single-light:v1',JSON.stringify({version:1,light:{angle:0,distance:2,power:50},observation:'',savedAt:'2026-11-22T00:00:00.000Z'}));
 await mount();await click('记录上方当前模拟参数');
 assert.equal(page().querySelector('.primary-action').textContent,'继续第一轮记录');
 const snapshot=localStorage.getItem(loopKey);await unmount();await mount();
 assert.equal(page().querySelector('.primary-action').textContent,'继续第一轮记录');
 await click('导航：记录');assert.ok(page().querySelector('.record-summary').textContent.includes('有未提交草稿'));
 assert.equal(localStorage.getItem(loopKey),snapshot);
 console.log('PASS nondefault simulation-only draft restores as a draft in both practice and read-only records without rewriting it');
 await unmount();dom.window.close();console.log('10 navigation groups passed (cached-page DOM model only, not native TabBar/Android/Windows).');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
