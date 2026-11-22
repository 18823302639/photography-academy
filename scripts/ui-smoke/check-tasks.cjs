// T05 real page components with explicit DOM/Taro adapters; no photo or device simulation claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');fs.mkdirSync(out,{recursive:true});
const dom=new JSDOM('<div id="root"></div>',{url:'https://tasks-test.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.Element.prototype.scrollIntoView=function(){};
dom.window.HTMLCanvasElement.prototype.getContext=()=>{throw Error('No DOM canvas renderer')};
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
esbuild.buildSync({stdin:{contents:
 'export {default as Page} from '+JSON.stringify(path.join(root,'apps/miniprogram/src/pages/index/index.tsx'))+';'+
 'export {default as Taro} from '+JSON.stringify(path.join(__dirname,'taro.ts'))+';'+
 'export * from '+JSON.stringify(path.join(root,'packages/photography-core/src/learning-loop.ts'))+';',resolveDir:__dirname},
 bundle:true,outfile:path.join(out,'task-test.cjs'),platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],
 alias:{'@tarojs/taro':path.join(__dirname,'taro.ts'),'@tarojs/components':path.join(__dirname,'components.tsx')}});
const api=require(path.join(out,'task-test.cjs'));let app;
async function mount(){await act(async()=>{app=createRoot(document.getElementById('root'));app.render(React.createElement(api.Page))})}
async function unmount(){await act(async()=>app.unmount())}
const form=()=>document.querySelector('#task-records');
const text=()=>form().textContent;
async function click(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);await act(async()=>b.click())}
async function input(i,value){const el=form().querySelectorAll('textarea')[i];assert.ok(el&&!el.disabled);await act(async()=>{
 Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));
});assert.equal(el.value,value)}
const id='exposure-compensation-v1',motion='shutter-motion-v1',key=api.loopStorageKey(id);
(async()=>{
 const legacy=fs.readFileSync(path.join(root,'tests/fixtures/legacy-loop-v1.json'),'utf8');
 localStorage.setItem(api.LOOP_KEY,legacy);
 await mount();assert.ok(text().includes('仅用于旧版本兼容测试'));
 await click('设备与任务');await click('查看曝光补偿任务与记录');
 assert.ok(text().includes('曝光补偿任务'));assert.ok(text().includes('须先在设备上确认手动快门与 ISO'));
 assert.ok([...form().querySelectorAll('textarea,button:not(.text-action)')].every(e=>e.disabled));
 assert.equal(localStorage.getItem(key),null);assert.equal(localStorage.getItem(api.LOOP_KEY),legacy);
 console.log('PASS conservative task gate, task sheet, legacy read compatibility and no cross-write');
 await click('设备与任务');await click('ML100 常亮灯');await click('手动快门与 ISO：未确认（点此切换）');await click('练习记录');
 assert.ok([...form().querySelectorAll('textarea')].every(e=>!e.disabled));
 await input(0,'自述测试，不是实拍验收');await input(1,'1/125 ISO100，其他未知');await input(2,'尚无照片验证');
 await click('保存第一轮并查看 Mock 点评');assert.ok(text().includes('Mock 点评 · mock-task-v1'));
 const snapshot=JSON.parse(localStorage.getItem(key)).first;
 assert.equal(snapshot.id,id+':first');assert.equal(snapshot.review.rubricVersion,id);
 assert.ok(!text().includes('模拟快照'));
 console.log('PASS eligible task records remain self-report, missing EXIF and explicitly Mock');
 await click('设备与任务');await click('查看凝固/模糊任务与记录');
 await input(0,'有意运动模糊');await input(1,'实际速度未知');await input(2,'模拟输入，未实拍');
 const motionDraft=localStorage.getItem(api.loopStorageKey(motion));
 await click('设备与任务');await click('查看曝光补偿任务与记录');assert.ok(text().includes('尚无照片验证'));
 assert.equal(JSON.parse(localStorage.getItem(key)).first.savedAt,snapshot.savedAt);
 await input(0,'复拍自述');await input(1,'1/250 ISO200');await input(2,'仍无照片');await input(3,'光量少一档，画质未知');
 await click('保存复拍与对比');assert.ok(text().includes('已记录复拍对比'));
 assert.equal(JSON.stringify(JSON.parse(localStorage.getItem(key)).first),JSON.stringify(snapshot));
 assert.equal(localStorage.getItem(api.loopStorageKey(motion)),motionDraft);
 assert.equal(localStorage.getItem(api.LOOP_KEY),legacy);
 console.log('PASS task-switch restore and two-round evidence cannot overwrite other tasks or first snapshot');
 await unmount();await mount();
 await click('设备与任务');await click('查看曝光补偿任务与记录');assert.ok(text().includes('已记录复拍对比'));
 await click('设备与任务');await click('查看凝固/模糊任务与记录');assert.equal(form().querySelector('textarea').value,'有意运动模糊');
 await click('设备与任务');await click('V1 闪光灯');await click('练习记录');assert.ok([...form().querySelectorAll('textarea,button:not(.text-action)')].every(e=>e.disabled));
 assert.equal(localStorage.getItem(api.loopStorageKey(motion)),motionDraft);
 await click('设备与任务');await click('查看曝光补偿任务与记录');assert.ok(text().includes('已记录复拍对比'));
 console.log('PASS remount restores each task; capability loss blocks new writes while saved evidence remains readable');
 await click('设备与任务');await click('ML100 常亮灯');await click('设备与任务');await click('查看凝固/模糊任务与记录');
 let finish;api.Taro.showModal=()=>new Promise(resolve=>{finish=resolve});
 await click('放弃当前草稿…');assert.ok(finish);
 await click('设备与任务');await click('查看单灯控制变量与记录');assert.ok(text().includes('仅用于旧版本兼容测试'));
 await act(async()=>finish({confirm:true}));
 assert.equal(localStorage.getItem(api.loopStorageKey(motion)),motionDraft);assert.equal(localStorage.getItem(api.LOOP_KEY),legacy);
 console.log('PASS old-task late cancel callback cannot erase a switched-away draft');
 await unmount();dom.window.close();console.log('5 task component groups passed (DOM adapter only).');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
