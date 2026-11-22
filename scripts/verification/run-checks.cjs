const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const timestamp=()=>new Date().toISOString();
function writeSummary(file,result){
 const temporary=file+'.tmp';
 fs.writeFileSync(temporary,JSON.stringify(result,null,2)+'\n');
 fs.renameSync(temporary,file);
}
function runStep(step,{cwd,env,logPath,signal,timeoutMs}){
 return new Promise(resolve=>{
  const fd=fs.openSync(logPath,'wx');
  let child,timer,forceTimer,reason=null,settled=false;
  const grouped=process.platform!=='win32';
  function kill(sig){
   if(!child||!child.pid)return;
   try{if(grouped)process.kill(-child.pid,sig);else child.kill(sig)}catch(e){if(e.code!=='ESRCH')reason=reason||e.message}
  }
  function stop(why){reason=reason||why;kill('SIGTERM');forceTimer=setTimeout(()=>kill('SIGKILL'),1000)}
  const abort=()=>stop('interrupted');
  function finish(code,childSignal,error){
   if(settled)return;settled=true;
   clearTimeout(timer);clearTimeout(forceTimer);signal?.removeEventListener('abort',abort);
   fs.closeSync(fd);
   resolve({status:code===0&&!reason&&!error&&!childSignal?'passed':'failed',exitCode:code??null,signal:childSignal||null,
    reason:reason||error||null});
  }
  if(signal?.aborted){finish(null,null,'interrupted');return}
  try{
   child=spawn(step.command,step.args||[],{cwd,env,stdio:['ignore',fd,fd],shell:false,detached:grouped});
   child.once('error',e=>finish(null,null,'spawn: '+e.message));
   child.once('close',(code,sig)=>finish(code,sig,null));
   signal?.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>stop('timeout'),step.timeoutMs??timeoutMs);
  }catch(e){finish(null,null,'spawn: '+e.message)}
 });
}
async function runChecks({steps,cwd,outDir,env=process.env,timeoutMs=180000,signal}){
 if(!Array.isArray(steps)||!steps.length||new Set(steps.map(s=>s.id)).size!==steps.length||
  steps.some(s=>!/^[a-z0-9-]+$/.test(s.id)||typeof s.command!=='string'||!s.command||
   (s.args!==undefined&&(!Array.isArray(s.args)||s.args.some(a=>typeof a!=='string')))))throw Error('Invalid check plan');
 fs.mkdirSync(path.dirname(outDir),{recursive:true});
 fs.mkdirSync(outDir); // Refuse an existing run directory; never overwrite prior evidence.
 const file=path.join(outDir,'result.json');
 const result={schemaVersion:1,scope:'cloud_automatic_checks_only',status:'running',cwd,startedAt:timestamp(),finishedAt:null,
  externalChecks:[
   {id:'devtools-close-reopen',status:'not_run',note:'Requires user-verified normal close/reopen; unknown settings prompts must not be discarded.'},
   {id:'real-device',status:'not_run'},{id:'lightroom-import',status:'not_run'}
  ],steps:steps.map(s=>({id:s.id,command:s.command,args:s.args||[],status:'not_run',exitCode:null,signal:null,reason:null,
   startedAt:null,finishedAt:null,log:s.id+'.txt'}))};
 writeSummary(file,result);
 try{
  for(let i=0;i<steps.length;i++){
   if(signal?.aborted){result.status='failed';result.reason='interrupted';break}
   const record=result.steps[i];record.status='running';record.startedAt=timestamp();writeSummary(file,result);
   process.stdout.write('START '+record.id+'\n');
   Object.assign(record,await runStep(steps[i],{cwd,env,logPath:path.join(outDir,record.log),signal,timeoutMs}));
   record.finishedAt=timestamp();writeSummary(file,result);process.stdout.write(record.status.toUpperCase()+' '+record.id+'\n');
   if(record.status!=='passed'){result.status='failed';break}
  }
  if(result.status==='running')result.status=result.steps.every(s=>s.status==='passed')?'passed':'failed';
 }catch(e){result.status='failed';result.reason=e.message}
 result.finishedAt=timestamp();writeSummary(file,result);
 return result;
}
module.exports={runChecks};
if(require.main===module){
 const root=path.resolve(__dirname,'../..');
 const npm=process.env.npm_execpath;
 const npmStep=(id,script)=>npm?{id,command:process.execPath,args:[npm,'run',script]}:{id,command:'npm',args:['run',script]};
 const steps=[
  {id:'runner-tests',command:process.execPath,args:['--test','scripts/verification/tests/runner.test.cjs']},
  npmStep('typescript-tests','test'),npmStep('typecheck','typecheck'),
  {id:'loop-components',command:process.execPath,args:['scripts/ui-smoke/check-loop.cjs']},
  {id:'lesson-components',command:process.execPath,args:['scripts/ui-smoke/check.cjs']},
  {id:'task-components',command:process.execPath,args:['scripts/ui-smoke/check-tasks.cjs']},
  {id:'python-tests',command:'python3',args:['-m','unittest','discover','-s','services/api/tests','-v']},
  npmStep('weapp-build','build:weapp')
 ];
 const id=timestamp().replace(/[:.]/g,'-')+'-'+process.pid;
 const outDir=path.join(root,'.verification-runs',id);
 const controller=new AbortController(),interrupt=()=>controller.abort();
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 runChecks({steps,cwd:root,outDir,env:{...process.env,PYTHONPATH:path.join(root,'services/api'),PYTHONDONTWRITEBYTECODE:'1'},signal:controller.signal})
  .then(r=>{console.log('Automatic checks: '+r.status+'; external checks: not run');console.log('Result: '+path.join(outDir,'result.json'));process.exitCode=controller.signal.aborted?130:r.status==='passed'?0:1})
  .catch(e=>{console.error(e.message);process.exitCode=1})
  .finally(()=>{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt)});
}
