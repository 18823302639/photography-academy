// Native API seam, NOT a WeChat emulator: real pinned Taro initNativeApi/processApis,
// production adapter/core, synthetic files and explicit callback/realm fault injection.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.ui-smoke');fs.mkdirSync(out,{recursive:true});
const stub=path.join(out,'native-taro-scaffold.cjs');
// initNativeApi also wires unrelated common HTTP machinery. It is not exercised here.
fs.writeFileSync(stub,'module.exports={options:{},Link:class {request(){throw Error("network forbidden")}addInterceptor(){}cleanInterceptors(){}}}');
const portDir=path.join(root,'apps/miniprogram/src/pages/index');
const oldSource=fs.readFileSync(path.join(root,'docs/verification/t09-file-compat-before-port.ts.txt'),'utf8');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'docs/verification/t09-file-compat-before-source.json'),'utf8'));
assert.equal(crypto.createHash('sha256').update(oldSource).digest('hex'),provenance.source_sha256);
const build=(contents,file,resolveDir=root)=>esbuild.buildSync({stdin:{contents,resolveDir,loader:'ts'},bundle:true,outfile:path.join(out,file),platform:'node',format:'cjs',alias:{'@tarojs/taro':stub}});
build('export * from '+JSON.stringify(path.join(portDir,'local-photo-port.ts'))+';'+
 'export {initNativeApi} from '+JSON.stringify(path.join(root,'node_modules/@tarojs/plugin-platform-weapp/dist/runtime-utils.js'))+';'+
 'export {default as Taro} from "@tarojs/taro";'+
 'export * from '+JSON.stringify(path.join(root,'packages/photography-core/src/photo-input.ts'))+';'+
 'export {readJpegExif} from '+JSON.stringify(path.join(root,'packages/photography-core/src/local-exif.ts'))+';','native-adapter-test.cjs');
build(oldSource+'\nexport {default as Taro} from "@tarojs/taro";','legacy-adapter-test.cjs',portDir);
global.getApp=()=>({});global.getCurrentPages=()=>[];global.requirePlugin=()=>({});
const data=fs.readFileSync(path.join(root,'tests/fixtures/exif-contract/normal.jpg'));
const local='http://tmp/synthetic.jpg',secret='/SYNTHETIC/PRIVATE/source.jpg DEVICE_SERIAL';
const foreignContext=vm.createContext({});
function foreign(bytes){const b=vm.runInContext('new ArrayBuffer('+bytes.length+')',foreignContext);new Uint8Array(b).set(bytes);return b}
let mode={},nativeCalls=[],lastBuffer;
const manager={
 getFileInfo(o){assert.equal(this,manager);nativeCalls.push('size');assert.equal(o.filePath,local);
  if(mode.size==='throw')throw Error(secret);
  if(mode.size==='fail'){o.fail({errMsg:secret});return}
  o.success({size:mode.size==='invalid'?'100':mode.size==='oversize'?10*1024*1024+1:data.length});
  if(mode.duplicate)o.fail({errMsg:secret});
 },
 readFile(o){assert.equal(this,manager);assert.equal(o.filePath,local);assert.equal(o.encoding,undefined);
  const phase=o.position===0&&o.length===3?'signature':'exif';nativeCalls.push(phase);
  if(mode.binary==='throw')throw Error(secret);
  if(mode.binary==='fail'||mode.exifFail&&phase==='exif'){o.fail({errMsg:secret});return}
  const bytes=data.subarray(o.position,o.position+o.length);
  let buffer;
  if(mode.binary==='spoof')buffer={byteLength:o.length,[Symbol.toStringTag]:'ArrayBuffer'};
  else if(mode.binary==='string')buffer='not binary '+secret;
  else if(mode.binary==='short')buffer=new ArrayBuffer(Math.max(0,o.length-1));
  else if(mode.binary==='whole')buffer=foreign(data);
  else if(mode.binary==='local'){buffer=new Uint8Array(bytes).buffer}
  else buffer=foreign(bytes);
  lastBuffer=buffer;o.success({data:buffer});if(mode.duplicate)o.fail({errMsg:secret});
 }
};
global.wx={
 getFileSystemManager(){assert.equal(this,global.wx);if(mode.manager==='throw')throw Error(secret);return manager},
 getImageInfo(o){assert.equal(this,global.wx);nativeCalls.push('decode');assert.equal(o.src,local);
  if(mode.decode==='throw')throw Error(secret);
  if(mode.decode==='fail'){o.fail({errMsg:secret});return}
  o.success(mode.decode==='invalid'?{}:{type:'jpeg',width:mode.decode==='oversize'?9000:96,height:mode.decode==='oversize'?5000:64});
 }
};
const api=require(path.join(out,'native-adapter-test.cjs')),legacy=require(path.join(out,'legacy-adapter-test.cjs'));
api.initNativeApi(api.Taro);api.initNativeApi(legacy.Taro);
const candidate={path:local,size:data.length};
function setup(next={}){mode=next;nativeCalls=[];const trace=[];const adapter=api.createLocalPhotoAdapter(api.Taro,c=>trace.push(c));return {adapter,trace}}
async function expectFailure(next,code){
 const {adapter,trace}=setup(next);
 await assert.rejects(api.inspectLocalJpeg(candidate,adapter.port),e=>e instanceof api.PhotoAdapterError&&e.code===code&&e.message===code);
 assert.ok(trace.includes(code));assert.ok(!JSON.stringify(trace).includes('SYNTHETIC'));return {trace,calls:[...nativeCalls]}
}
(async()=>{
 setup();const buffer=foreign([255,216,255]);assert.equal(buffer instanceof ArrayBuffer,false);
 assert.equal(await legacy.localPhotoPort.size(local),data.length);
 await assert.rejects(legacy.localPhotoPort.header(local),/binary read required/);
 assert.ok(!nativeCalls.includes('decode'));
 console.log('PASS exact archived adapter rejects a genuine foreign ArrayBuffer through pinned Taro API initialization');
 for(const binary of ['local','foreign']){
  const {adapter,trace}=setup({binary});const preview=await api.inspectLocalJpeg(candidate,adapter.port);
  const exif=await api.readJpegExif(preview.bytes,(p,n)=>adapter.readRange(local,p,n));
  assert.equal(exif.values.iso,200);assert.equal(exif.values.exposure_seconds,.008);
  assert.deepEqual(trace.slice(0,6),['size.begin','size.ok','signature.begin','signature.ok','decode.begin','decode.ok']);
  assert.ok(nativeCalls.includes('exif'));
 }
 const copy=setup();const header=await copy.adapter.port.header(local);new Uint8Array(lastBuffer)[0]=0;assert.equal(header[0],255);
 console.log('PASS production adapter accepts same/foreign context buffers, preserves receivers and copies validated bytes; actual synthetic EXIF parses');
 for(const [binary,code] of [['spoof','signature.binary_invalid'],['string','signature.binary_invalid'],['short','signature.length_invalid'],['whole','signature.length_invalid'],['fail','signature.failed'],['throw','signature.threw']]){
  const result=await expectFailure({binary},code);assert.ok(!result.calls.includes('decode'));
 }
 console.log('PASS spoofed/non-binary/short/whole-file and failed signature reads reject before decode without raw errors');
 for(const [next,code] of [[{size:'fail'},'size.failed'],[{size:'throw'},'size.threw'],[{size:'invalid'},'size.response_invalid'],[{manager:'throw'},'size.threw']]){
  const r=await expectFailure(next,code);assert.ok(!r.calls.includes('signature'));
 }
 const noApiTrace=[];await assert.rejects(api.createLocalPhotoAdapter({},c=>noApiTrace.push(c)).port.size(local),/size.unavailable/);
 assert.deepEqual(noApiTrace,['size.begin','size.unavailable']);
 const oversized=setup({size:'oversize'});await assert.rejects(api.inspectLocalJpeg(candidate,oversized.adapter.port),api.PhotoInputError);
 assert.deepEqual(nativeCalls,['size']);
 console.log('PASS manager/size availability, callbacks, shapes and byte limit remain enforced before file reads');
 for(const decode of ['fail','throw'])await expectFailure({decode},'decode.failed');
 await expectFailure({decode:'invalid'},'decode.response_invalid');
 const pixels=setup({decode:'oversize'});await assert.rejects(api.inspectLocalJpeg(candidate,pixels.adapter.port),api.PhotoInputError);
 assert.ok(!nativeCalls.includes('exif'));
 console.log('PASS actual Taro Promise bridge rejects image failures and malformed responses; pixel limits precede EXIF');
 const badExif=setup({exifFail:true});const preview=await api.inspectLocalJpeg(candidate,badExif.adapter.port);
 const exif=await api.readJpegExif(preview.bytes,(p,n)=>badExif.adapter.readRange(local,p,n));
 assert.equal(exif.container,'unreadable');assert.equal(exif.values.iso,null);assert.ok(badExif.trace.includes('exif.failed'));
 assert.ok(!JSON.stringify(exif).includes('SYNTHETIC'));
 const duplicate=setup({duplicate:true});await api.inspectLocalJpeg(candidate,duplicate.adapter.port);
 assert.ok(!duplicate.trace.some(c=>c.endsWith('.failed')));
 setup();const remote=api.createLocalPhotoAdapter(api.Taro);await assert.rejects(api.inspectLocalJpeg({...candidate,path:'https://example.com/synthetic.jpg'},remote.port),api.PhotoInputError);
 assert.deepEqual(nativeCalls,[]);
 console.log('PASS EXIF IO failure remains unreadable, duplicate callbacks do not corrupt settled operations, and remote paths never reach native IO');
 console.log('6 native adapter seam groups passed; wx file/image callbacks are injected, not Windows/WeChat execution.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>esbuild.stop());
