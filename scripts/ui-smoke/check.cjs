// Automated component integration checks in JSDOM, not browser/WeChat validation.
const {JSDOM}=require('jsdom'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');
fs.mkdirSync(out,{recursive:true});
const dom=new JSDOM('<div id="root"></div>',{url:'https://component-test.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT=true;
let scrolledId='';
dom.window.Element.prototype.scrollIntoView=function(){scrolledId=this.id};
dom.window.HTMLCanvasElement.prototype.getContext=()=>{throw Error('No canvas renderer in component test')};
const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React;
esbuild.buildSync({entryPoints:[path.join(root,'apps/miniprogram/src/pages/index/index.tsx')],bundle:true,outfile:path.join(out,'component.cjs'),platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],alias:{'@tarojs/taro':path.join(__dirname,'taro.ts'),'@tarojs/components':path.join(__dirname,'components.tsx')}});
const Page=require(path.join(out,'component.cjs')).default;
let app;
async function mount(){await act(async()=>{app=createRoot(document.getElementById('root'));app.render(React.createElement(Page))})}
async function unmount(){await act(async()=>app.unmount())}
function text(){return document.body.textContent}
async function click(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,'Button missing: '+label);assert.equal(b.disabled,false);await act(async()=>b.click())}
function contains(s){assert.ok(text().includes(s),'Missing rendered text: '+s)}
const key='photography-academy:device-profile:v1';
(async()=>{
 await mount();await click('设备与任务');
 contains('当前设备：手机');contains('快门 否 / ISO 否 / 光圈 否');
 await click('ML100 常亮灯');contains('只比较阴影形状');
 await click('手动快门与 ISO：未确认（点此切换）');
 contains('关闭自动 ISO');contains('快门 是 / ISO 是 / 光圈 否');
 await click('选择 R7');contains('快门 否 / ISO 否 / 光圈 否');
 await click('镜头可调光圈：未确认（点此切换）');
 await click('手动快门与 ISO：未确认（点此切换）');
 contains('快门 是 / ISO 是 / 光圈 是');
 const persisted=JSON.parse(localStorage.getItem(key));assert.equal(persisted.device,'r7');assert.equal(persisted.apertureConfirmed,true);
 console.log('PASS: device selection, conservative phone defaults, confirmed capabilities and device-switch reset');
 await unmount();await mount();await click('设备与任务');
 contains('已恢复本机设备档案');contains('当前设备：R7');contains('快门 是 / ISO 是 / 光圈 是');
 console.log('PASS: component unmount/remount restores device profile');
 await click('展开曝光微课');
 await click('用 ISO 补一档：f/4 · 1/250 秒 · ISO 200');
 contains('光量项 -1.00 档；ISO 指数项 +1.00 档；等效合计 +0.00 档');
 await click('延时补两档：f/8 · 1/31.25 秒 · ISO 100');
 contains('光量项 +0.00 档；ISO 指数项 +0.00 档；等效合计 +0.00 档');
 console.log('PASS: rendered lesson arithmetic separates light and ISO');
 const storedBeforeExercise=Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]});
 contains('先选择一个方案，再核对档数和原因。');
 await click('试选 ISO 100');contains('尚未回到目标，可换一个方案');
 await click('试选 ISO 200');contains('本次计算相符。光量项 -1.00 档；ISO 指数项 +1.00 档；等效合计 +0.00 档');
 contains('没有补回光子');
 await click('练习 B：缩小光圈，只改时间');
 assert.ok(!text().includes('本次计算相符'));contains('先选择一个方案，再核对档数和原因。');
 await click('试选 1/500 秒');contains('光量项 -4.00 档');
 await click('试选 1/31.25 秒');contains('本次计算相符。光量项 +0.00 档');
 await click('重新作答本题');assert.ok(!text().includes('本次计算相符'));
 await click('练习 A：快门减半，只改 ISO');contains('先选择一个方案，再核对档数和原因。');
 assert.deepEqual(Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]}),storedBeforeExercise);
 console.log('PASS compensation answer feedback, physical/index distinction, question/reset state and no persisted-record writes');
 const motionTrail=()=>document.querySelector('.motion-trail');
 contains('快门与运动轨迹 · 静态示意');
 assert.equal(motionTrail().style.width,'16%');
 await click('运动示意：1/250 秒');assert.equal(motionTrail().style.width,'8%');
 await click('示意速度：1000 单位/秒');assert.equal(motionTrail().style.width,'4%');
 await click('运动示意：1/62.5 秒');assert.equal(motionTrail().style.width,'16%');
 await click('示意速度：2000 单位/秒');assert.equal(motionTrail().style.width,'32%');
 assert.equal(document.querySelector('.motion-end').style.left,'42%');
 contains('长度 32.00 示意单位');contains('相对 1/125 秒为 2.00 倍');
 contains('不保证真实照片的模糊程度');
 assert.deepEqual(Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]}),storedBeforeExercise);
 console.log('PASS shutter/speed changes update static trajectory geometry and labels without persistence writes');


 await click('进入已有单灯练习与记录');assert.equal(scrolledId,'single-light-practice');
 contains('已进入单灯练习');contains('单灯任务 · Mock 学习闭环');
 assert.equal(localStorage.getItem('photography-academy:learning-loop:v1'),null);
 console.log('PASS: practice entry targets existing page and does not create/overwrite a submission');
 await click('设备与任务');await click('V1 闪光灯');contains('V1 不作为本课常亮灯');
 assert.ok(text().includes('先做单灯模拟观察'));
 await click('选择手机');contains('快门 否 / ISO 否 / 光圈 否');
 assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent.startsWith('镜头可调光圈')));
 console.log('PASS: flash routes to simulation; phone hides aperture confirmation');
 // Fault injection stays inside this in-memory test environment.
 const prior=localStorage.getItem(key),set=dom.window.Storage.prototype.setItem;
 dom.window.Storage.prototype.setItem=()=>{throw Error('quota')};
 await click('选择 R7');contains('保存失败，仍使用上次设备选择');contains('当前设备：手机');
 assert.equal(localStorage.getItem(key),prior);dom.window.Storage.prototype.setItem=set;
 console.log('PASS: failed profile write retains prior selection and durable record');
 await unmount();localStorage.setItem(key,'{"version":99}');
 await mount();await click('设备与任务');contains('设备记录无法读取');
 assert.ok([...document.querySelectorAll('button')].find(b=>b.textContent==='选择 R7').disabled);
 assert.equal(localStorage.getItem(key),'{"version":99}');
 console.log('PASS: unknown profile version blocks writes without overwriting data');
 await unmount();dom.window.close();console.log('9 component checks passed; no browser, native layout or WeChat runtime claims.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
