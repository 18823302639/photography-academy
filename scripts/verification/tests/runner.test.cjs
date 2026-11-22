const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {runChecks}=require('../run-checks.cjs');
const node=(id,code)=>({id,command:process.execPath,args:['-e',code]});
async function scenario(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'photo-s1-checks-'));
 try{await fn(dir,path.join(dir,'run'))}finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('all checks pass with individual exit codes and logs; external checks remain not_run',()=>scenario(async(cwd,outDir)=>{
 const result=await runChecks({cwd,outDir,steps:[node('a','console.log("A")'),node('b','console.error("B")')]});
 assert.equal(result.status,'passed');assert.deepEqual(result.steps.map(s=>s.exitCode),[0,0]);
 assert.equal(fs.readFileSync(path.join(outDir,'a.txt'),'utf8').trim(),'A');
 assert.equal(fs.readFileSync(path.join(outDir,'b.txt'),'utf8').trim(),'B');
 assert.ok(result.externalChecks.every(s=>s.status==='not_run'));
 assert.equal(JSON.parse(fs.readFileSync(path.join(outDir,'result.json'))).status,'passed');
}));
test('a nonzero exit stops later checks and cannot be masked by a later success',()=>scenario(async(cwd,outDir)=>{
 const result=await runChecks({cwd,outDir,steps:[node('bad','process.exit(7)'),node('would-pass','console.log("must not run")')]});
 assert.equal(result.status,'failed');assert.equal(result.steps[0].exitCode,7);assert.equal(result.steps[1].status,'not_run');
 assert.equal(fs.existsSync(path.join(outDir,'would-pass.txt')),false);
}));
test('missing executable fails explicitly with remaining checks not_run',()=>scenario(async(cwd,outDir)=>{
 const result=await runChecks({cwd,outDir,steps:[{id:'missing',command:path.join(cwd,'does-not-exist')},node('next','')]});
 assert.equal(result.status,'failed');assert.equal(result.steps[0].exitCode,null);assert.match(result.steps[0].reason,/spawn:/);
 assert.equal(result.steps[1].status,'not_run');
}));
test('timeout cannot be reported as success and leaves a recoverable result',()=>scenario(async(cwd,outDir)=>{
 const result=await runChecks({cwd,outDir,timeoutMs:100,steps:[node('slow','setInterval(()=>{},1000)'),node('next','')]});
 assert.equal(result.status,'failed');assert.equal(result.steps[0].reason,'timeout');assert.equal(result.steps[1].status,'not_run');
 assert.equal(JSON.parse(fs.readFileSync(path.join(outDir,'result.json'))).status,'failed');
}));
test('interruption aborts its own check and does not mark later steps passed',()=>scenario(async(cwd,outDir)=>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),100);
 try{
  const result=await runChecks({cwd,outDir,signal:controller.signal,steps:[node('waiting','setInterval(()=>{},1000)'),node('next','')]});
  assert.equal(result.status,'failed');assert.equal(result.steps[0].reason,'interrupted');assert.equal(result.steps[1].status,'not_run');
 }finally{clearTimeout(timer)}
}));
test('arguments are passed literally without shell interpretation',()=>scenario(async(cwd,outDir)=>{
 const value='$(not-a-command); text with spaces';
 const result=await runChecks({cwd,outDir,steps:[{id:'literal',command:process.execPath,args:['-e','console.log(process.argv[1])',value]}]});
 assert.equal(result.status,'passed');assert.equal(fs.readFileSync(path.join(outDir,'literal.txt'),'utf8').trim(),value);
}));
test('existing evidence and invalid duplicate IDs cannot be overwritten',()=>scenario(async(cwd,outDir)=>{
 const options={cwd,outDir,steps:[node('one','')]};
 await runChecks(options);const before=fs.readFileSync(path.join(outDir,'result.json'),'utf8');
 await assert.rejects(runChecks(options),/EEXIST/);assert.equal(fs.readFileSync(path.join(outDir,'result.json'),'utf8'),before);
 await assert.rejects(runChecks({...options,outDir:path.join(cwd,'new'),steps:[node('same',''),node('same','')]}),/Invalid check plan/);
}));
