// Real React component + explicit Taro/DOM adapter; not a DevTools or process-restart test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');
fs.mkdirSync(out,{recursive:true});
const dom=new JSDOM('<div id="root"></div>',{url:'https://loop-test.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React;
esbuild.buildSync({stdin:{contents:
 'export {default as Loop} from '+JSON.stringify(path.join(root,'apps/miniprogram/src/pages/index/learning-loop.tsx'))+';'+
 'export {default as Taro} from '+JSON.stringify(path.join(__dirname,'taro.ts'))+';'+
 'export * from '+JSON.stringify(path.join(root,'packages/photography-core/src/learning-loop.ts'))+';',
 resolveDir:__dirname},bundle:true,outfile:path.join(out,'loop-test.cjs'),platform:'node',format:'cjs',jsx:'automatic',
 external:['react','react-dom','react/jsx-runtime'],alias:{'@tarojs/taro':path.join(__dirname,'taro.ts'),'@tarojs/components':path.join(__dirname,'components.tsx')}});
const api=require(path.join(out,'loop-test.cjs')),key=api.LOOP_KEY;
let app;
async function mount(){await act(async()=>{app=createRoot(document.getElementById('root'));app.render(React.createElement(api.Loop,{light:{angle:45,distance:1,power:100}}))})}
async function unmount(){await act(async()=>app.unmount())}
function disk(){return JSON.parse(localStorage.getItem(key))}
function text(){return document.body.textContent}
async function click(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);await act(async()=>b.click())}
async function input(i,value){const area=document.querySelectorAll('textarea')[i];assert.ok(area);await act(async()=>{
 Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(area,value);
 area.dispatchEvent(new window.Event('input',{bubbles:true}));
});assert.equal(area.value,value)}
function seed(){const s=api.newLoop();s.draft={...s.draft,intent:'低调模拟',conditions:'模拟条件，曝光未知',observation:'第一轮模拟观察'};localStorage.setItem(key,JSON.stringify(s))}
(async()=>{
 seed();await mount();
 await click('保存第一轮并查看 Mock 点评');const first=JSON.stringify(disk().first);
 await input(0,'复拍模拟');await input(1,'只改灯距');await input(2,'第二轮模拟观察');await input(3,'亮度变化未经照片验证');
 assert.equal(disk().draft.reflection,'亮度变化未经照片验证');
 await unmount();await mount();
 assert.equal(document.querySelectorAll('textarea')[3].value,'亮度变化未经照片验证');
 await click('保存复拍与对比');assert.equal(JSON.stringify(disk().first),first);
 assert.ok(disk().retake);assert.ok(text().includes('已记录复拍对比'));
 const both=localStorage.getItem(key);await unmount();await mount();
 assert.equal(localStorage.getItem(key),both);assert.ok(text().includes('第二轮模拟观察'));
 assert.equal(document.querySelectorAll('textarea').length,0);
 console.log('PASS two-round real component inputs, snapshot preservation, remount and evidence restore');
 await unmount();const reordered=disk();
 for(const round of ['first','retake'])reordered[round].review=Object.fromEntries(Object.entries(reordered[round].review).reverse());
 localStorage.setItem(key,JSON.stringify(reordered));const reorderedDisk=localStorage.getItem(key);
 await mount();assert.ok(text().includes('已记录复拍对比'));assert.ok(!text().includes('记录版本未知或损坏'));
 assert.equal(localStorage.getItem(key),reorderedDisk);
 console.log('PASS semantically identical reordered review objects restore without rewriting historical data');
 await unmount();seed();await mount();
 api.Taro.showModal=async()=>({confirm:false});
 const before=localStorage.getItem(key);await click('放弃当前草稿…');assert.equal(localStorage.getItem(key),before);
 api.Taro.showModal=async()=>({confirm:true});await click('放弃当前草稿…');assert.equal(disk().draft.intent,'');
 console.log('PASS cancel refusal preserves draft; confirmation clears only active draft');
 await unmount();seed();await mount();
 const set=dom.window.Storage.prototype.setItem;dom.window.Storage.prototype.setItem=()=>{throw Error('quota')};
 await input(2,'留在页面的未落盘观察');assert.ok(text().includes('草稿保存失败'));
 await click('保存第一轮并查看 Mock 点评');assert.equal(disk().first,null);
 assert.equal(document.querySelectorAll('textarea')[2].value,'留在页面的未落盘观察');
 dom.window.Storage.prototype.setItem=set;await click('重试保存草稿');
 await click('保存第一轮并查看 Mock 点评');assert.equal(disk().first.draft.observation,'留在页面的未落盘观察');
 console.log('PASS failed draft/submission writes preserve inputs; retry commits once');
 // Reproduce the previously uncovered late-modal/unmount race.
 await unmount();seed();await mount();let finish;
 api.Taro.showModal=()=>new Promise(resolve=>{finish=resolve});
 await click('放弃当前草稿…');assert.ok(finish);
 await unmount();await mount();await input(2,'重新进入后最新观察');
 const latest=localStorage.getItem(key);
 await act(async()=>finish({confirm:true}));
 assert.equal(localStorage.getItem(key),latest,'late confirmation from unmounted page must not overwrite newer draft');
 assert.equal(document.querySelectorAll('textarea')[2].value,'重新进入后最新观察');
 console.log('PASS late confirmation after unmount cannot overwrite remounted draft');
 await unmount();dom.window.close();console.log('5 loop component groups passed (DOM adapter only).');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
