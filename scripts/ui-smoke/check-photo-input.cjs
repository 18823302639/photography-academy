// Real React component + local filesystem fixtures, with explicit Taro/DOM adapters.
// JSDOM does not decode images: Image load/error events are deliberately injected.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');fs.mkdirSync(out,{recursive:true});
const dom=new JSDOM('<div id="root"></div>',{url:'https://photo-test.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
esbuild.buildSync({stdin:{contents:
 'export {default as Photo} from '+JSON.stringify(path.join(root,'apps/miniprogram/src/pages/index/local-photo.tsx'))+';'+
 'export {default as Taro} from '+JSON.stringify(path.join(__dirname,'taro.ts'))+';',resolveDir:__dirname},
 bundle:true,outfile:path.join(out,'photo-input-test.cjs'),platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],
 alias:{'@tarojs/taro':path.join(__dirname,'taro.ts'),'@tarojs/components':path.join(__dirname,'components.tsx')}});
const {Photo,Taro}=require(path.join(out,'photo-input-test.cjs'));let app;
const files=new Map(['landscape.jpg','portrait.jpg','png-disguised.jpg','truncated.jpg'].map(name=>[
 'http://tmp/'+name,fs.readFileSync(path.join(root,'tests/fixtures/photo-input',name))]));
for(const name of ['normal','no_exif','invalid_fields','unreadable_exif','xmp_only'])
 files.set('http://tmp/'+name+'.jpg',fs.readFileSync(path.join(root,'tests/fixtures/exif-contract',name+'.jpg')));
const selection=name=>({tempFiles:[{tempFilePath:'http://tmp/'+name,size:files.get('http://tmp/'+name).length}]});
let pick=async()=>selection('landscape.jpg'),calls=[],heldSize=null,heldInfo=null,heldRange=null,heldSignature=null;
Taro.chooseMedia=async opts=>{calls.push(['choose',opts]);assert.deepEqual(opts,{count:1,mediaType:['image'],sourceType:['album'],sizeType:['original']});return pick()};
Taro.getFileSystemManager=()=>({
 getFileInfo:opts=>{calls.push(['size',opts.filePath]);if(heldSize){heldSize(opts);return}opts.success({size:files.get(opts.filePath).length})},
 readFile:opts=>{const header=opts.position===0&&opts.length===3;calls.push([header?'header':'range',opts.filePath]);assert.equal(opts.encoding,undefined);
  assert.ok(opts.position>=0&&opts.length>0&&opts.length<65536&&opts.position+opts.length<=files.get(opts.filePath).length);
  if(header&&heldSignature){heldSignature(opts);return}
  if(!header&&heldRange){heldRange(opts);return}
  const b=files.get(opts.filePath).subarray(opts.position,opts.position+opts.length);opts.success({data:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)})}
});
Taro.getImageInfo=async({src})=>{
 calls.push(['info',src]);assert.ok(files.has(src),'only picker local path reaches imageInfo');
 if(heldInfo)return heldInfo(src);
 if(src.endsWith('truncated.jpg'))throw {errMsg:'getImageInfo:fail invalid image'};
 return {type:'jpeg',width:src.endsWith('portrait.jpg')?64:96,height:src.endsWith('portrait.jpg')?96:64}
};
for(const key of ['getStorageSync','setStorageSync','removeStorageSync','request','uploadFile','downloadFile','saveFile'])
 Taro[key]=()=>{throw Error('Offline preview must not call '+key)};
const section=()=>document.querySelector('#local-photo-input');
const status=()=>document.querySelector('#local-photo-status').textContent;
const images=()=>[...section().querySelectorAll('img')];
const selected=()=>images().find(i=>i.parentNode.textContent.includes('当前离线预览'));
async function click(label){const b=[...section().querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);await act(async()=>b.click())}
async function load(){const img=images().find(i=>i.parentNode.textContent.includes('候选图'));assert.ok(img);await act(async()=>img.dispatchEvent(new window.Event('load')))}
async function mount(){await act(async()=>{app=createRoot(document.getElementById('root'));app.render(React.createElement(Photo))})}
async function unmount(){await act(async()=>app.unmount())}
(async()=>{
 await mount();assert.equal(images().length,0);assert.equal(localStorage.length,0);
 pick=async()=>{throw {errMsg:'chooseMedia:fail cancel'}};
 await click('选择照片');assert.ok(status().includes('已取消'));assert.equal(images().length,0);
 assert.ok(document.querySelector('#local-photo-diagnostic').textContent.includes('pick.cancel'));
 pick=async()=>selection('landscape.jpg');await click('选择照片');
 assert.equal(section().querySelector('button').disabled,true);assert.ok(status().includes('等待图片组件载入'));
 const firstCandidate=images()[0];await load();assert.equal(selected(),firstCandidate,'commit must reuse the loaded Image node');
 assert.ok(selected().src.endsWith('landscape.jpg'));assert.ok(status().includes('离线预览已载入'));
 assert.ok(section().textContent.includes('当前输入 JPEG 未发现 EXIF 块'));assert.ok(section().textContent.includes('96 × 64'));
 console.log('PASS empty cancel and synthetic JPEG preflight to explicit Image load; no EXIF fabrication');
 pick=async()=>selection('png-disguised.jpg');await click('更换照片');
 assert.ok(status().includes('只接受 JPEG'));assert.ok(selected().src.endsWith('landscape.jpg'));
 assert.equal(calls.filter(c=>c[0]==='info'&&c[1].endsWith('png-disguised.jpg')).length,0);
 pick=async()=>selection('truncated.jpg');await click('更换照片');
 assert.ok(status().includes('检查失败'));assert.ok(selected().src.endsWith('landscape.jpg'));
 pick=async()=>{throw {errMsg:'chooseMedia:fail auth deny'}};await click('更换照片');
 assert.ok(!status().includes('已取消'));assert.ok(selected().src.endsWith('landscape.jpg'));
 pick=async()=>{throw {errMsg:'chooseMedia:fail cancel'}};await click('更换照片');
 assert.ok(status().includes('已取消'));assert.ok(selected().src.endsWith('landscape.jpg'));
 console.log('PASS disguised PNG, decoder failure, permission error and replacement cancel preserve old preview');
 pick=async()=>selection('portrait.jpg');await click('更换照片');
 let candidate=images().find(i=>i.parentNode.textContent.includes('候选图'));
 await act(async()=>candidate.dispatchEvent(new window.Event('error')));
 assert.ok(status().includes('无法载入'));assert.ok(selected().src.endsWith('landscape.jpg'));
 await click('更换照片');const old=selected();await load();
 assert.ok(selected().src.endsWith('portrait.jpg'));assert.ok(section().textContent.includes('64 × 96'));
 await act(async()=>old.dispatchEvent(new window.Event('error')));assert.ok(selected().src.endsWith('portrait.jpg'));
 console.log('PASS candidate renderer rejection preserves old image; successful replacement commits only after load');
 // Exit during pending image info; start and commit a newer request, then resolve the old request.
 let finish;heldInfo=()=>new Promise(resolve=>{finish=resolve});pick=async()=>selection('landscape.jpg');
 await click('更换照片');assert.ok(finish);await click('退出并清除预览');assert.equal(images().length,0);
 heldInfo=null;pick=async()=>selection('portrait.jpg');await click('选择照片');await load();
 await act(async()=>finish({type:'jpeg',width:96,height:64}));
 assert.ok(selected().src.endsWith('portrait.jpg'));assert.ok(status().includes('已载入'));
 console.log('PASS exit invalidates an old request without allowing it to overwrite a newer preview');
 let statReply;heldSize=opts=>{statReply=opts};await click('更换照片');await click('退出并清除预览');
 const reads=calls.filter(c=>c[0]==='header').length;
 await act(async()=>statReply.success({size:files.get('http://tmp/portrait.jpg').length}));
 assert.equal(calls.filter(c=>c[0]==='header').length,reads);assert.equal(images().length,0);
 heldSize=null;await click('选择照片');candidate=images()[0];await click('退出并清除预览');
 await act(async()=>candidate.dispatchEvent(new window.Event('load')));assert.equal(images().length,0);
 console.log('PASS exit before header stops later IO; late Image load cannot resurrect exited preview');
 heldSize=opts=>{statReply=opts};await click('选择照片');await unmount();
 const before=calls.length;
 await act(async()=>statReply.success({size:files.get('http://tmp/portrait.jpg').length}));
 assert.equal(calls.length,before);heldSize=null;await mount();
 assert.equal(images().length,0);assert.ok(status().includes('尚未选择'));assert.equal(localStorage.length,0);
 console.log('PASS unmount invalidates IO; remount starts empty with no photo persistence or network calls');
 pick=async()=>({tempFiles:[]});await click('选择照片');assert.ok(status().includes('请选择一张'));
 pick=async()=>({tempFiles:[{tempFilePath:'https://example.com/private.jpg',size:100}]});
 const infoCount=calls.filter(c=>c[0]==='info').length;await click('选择照片');
 assert.ok(status().includes('不会尝试网络下载'));assert.equal(calls.filter(c=>c[0]==='info').length,infoCount);
 assert.ok(document.querySelector('#local-photo-diagnostic').textContent.includes('candidate.rejected'));
 console.log('PASS invalid selection and remote path are rejected before image information IO');
 pick=async()=>selection('normal.jpg');await click('选择照片');await load();
 const params=()=>section().querySelector('.local-exif')?.textContent||'';
 assert.ok(params().includes('快门：0.008 秒'));assert.ok(params().includes('光圈：f/4'));assert.ok(params().includes('ISO：200'));assert.ok(params().includes('焦距：50 mm'));assert.ok(params().includes('方向标签：6'));
 assert.ok(!section().textContent.includes('SYNTHETIC_PRIVATE'));assert.ok(!params().includes('http://tmp/'));
 pick=async()=>{throw {errMsg:'chooseMedia:fail cancel'}};await click('更换照片');assert.ok(params().includes('ISO：200'));
 pick=async()=>selection('png-disguised.jpg');await click('更换照片');assert.ok(params().includes('ISO：200'));
 console.log('PASS actual JPEG bytes reach the shared EXIF projection and UI; cancel/reject preserve matching parameters without identity fields');
 pick=async()=>selection('no_exif.jpg');await click('更换照片');assert.ok(params().includes('ISO：200'));
 await load();assert.ok(params().includes('ISO：缺失'));assert.ok(!params().includes('ISO：200'));
 for(const [name,label] of [['invalid_fields','无效或超出协议范围'],['unreadable_exif','无法可靠读取'],['xmp_only','缺失']]){
  pick=async()=>selection(name+'.jpg');await click('更换照片');await load();assert.ok(params().includes('ISO：'+label));
 }
 heldRange=opts=>opts.fail({errMsg:'/SYNTHETIC/PRIVATE native unavailable'});
 pick=async()=>selection('normal.jpg');await click('更换照片');await load();assert.ok(params().includes('ISO：无法可靠读取'));
 assert.ok(document.querySelector('#local-photo-diagnostic').textContent.includes('exif.failed'));
 assert.ok(document.querySelector('#local-photo-diagnostic').textContent.includes('exif.unreadable'));
 assert.ok(!section().textContent.includes('SYNTHETIC'));heldRange=null;
 console.log('PASS absence, invalid values, malformed metadata and unavailable binary reads cannot become fabricated values or false absence');
 let oldRead;heldRange=opts=>{oldRead=opts};await click('更换照片');assert.ok(oldRead);
 const chooseCalls=calls.filter(c=>c[0]==='choose').length;
 section().querySelector('button').click();assert.equal(calls.filter(c=>c[0]==='choose').length,chooseCalls);
 await click('退出并清除预览');heldRange=null;
 pick=async()=>selection('no_exif.jpg');await click('选择照片');await load();assert.ok(params().includes('ISO：缺失'));
 const oldBytes=files.get(oldRead.filePath).subarray(oldRead.position,oldRead.position+oldRead.length),beforeLate=calls.length;
 await act(async()=>oldRead.success({data:oldBytes.buffer.slice(oldBytes.byteOffset,oldBytes.byteOffset+oldBytes.byteLength)}));
 assert.equal(calls.length,beforeLate);assert.ok(params().includes('ISO：缺失'));assert.ok(selected().src.endsWith('no_exif.jpg'));
 await click('退出并清除预览');assert.equal(params(),'');assert.equal(images().length,0);assert.equal(localStorage.length,0);
 assert.ok(section().textContent.includes('没有生成脱敏派生图'));
 console.log('PASS overlapping replacement after exit ignores late EXIF and preserves the new image/parameter pair; no derived or storage claims');
 const diagnostic=()=>document.querySelector('#local-photo-diagnostic').textContent;
 pick=async()=>selection('normal.jpg');heldSize=opts=>opts.fail({errMsg:'/SYNTHETIC/PRIVATE size error'});
 await click('选择照片');assert.ok(status().includes('阶段 size'));assert.ok(diagnostic().includes('size.failed'));assert.equal(images().length,0);heldSize=null;
 heldSignature=opts=>opts.fail({errMsg:'/SYNTHETIC/PRIVATE signature error'});
 await click('选择照片');assert.ok(status().includes('阶段 signature'));assert.ok(diagnostic().includes('signature.failed'));heldSignature=null;
 heldInfo=async()=>{throw Error('/SYNTHETIC/PRIVATE decode error')};
 await click('选择照片');assert.ok(status().includes('阶段 decode'));assert.ok(diagnostic().includes('decode.failed'));heldInfo=null;
 assert.ok(!section().textContent.includes('SYNTHETIC'));assert.ok(!diagnostic().includes('http://tmp/'));
 console.log('PASS fixed UI stage diagnostics distinguish size/signature/decode failures without paths or raw error text');
 await unmount();dom.window.close();console.log('11 photo input component groups passed (DOM/Taro adapters; real synthetic file reads, not WeChat decoding).');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
