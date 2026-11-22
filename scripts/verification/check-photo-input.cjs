// Single, finite T09 input/EXIF check. Does not create or resume a Goal.
const path=require('node:path');
const {runChecks}=require('./run-checks.cjs');
const root=path.resolve(__dirname,'../..'),npm=process.env.npm_execpath;
const npmStep=(id,script)=>npm?{id,command:process.execPath,args:[npm,'run',script]}:{id,command:'npm',args:['run',script]};
const component=id=>({id:id+'-components',command:process.execPath,args:['scripts/ui-smoke/check'+(id==='lesson'?'':'-'+id)+'.cjs']});
if(process.argv[2]!==undefined&&!['exif-contract','photo-exif','file-compat','navigation'].includes(process.argv[2]))throw Error('Unknown check scope');
const scope=process.argv[2]||'photo';
const steps=[{id:'runner-tests',command:process.execPath,args:['--test','scripts/verification/tests/runner.test.cjs']},
 npmStep('typescript-tests','test'),npmStep('typecheck','typecheck'),
 component('loop'),component('lesson'),component('tasks'),component('photo-input'),
 {id:'native-adapter',command:process.execPath,args:['scripts/ui-smoke/check-photo-native-adapter.cjs']},
 {id:'navigation',command:process.execPath,args:['scripts/ui-smoke/check-navigation.cjs']},
 {id:'python-tests',command:'python3',args:['-m','unittest','discover','-s','services/api/tests','-v']},
 npmStep('weapp-build',scope==='navigation'?'build:weapp:offline':'build:weapp'),
 ...(scope==='navigation'?[{id:'native-ui-artifact',command:process.execPath,args:['scripts/ui-smoke/check-weapp-ui.cjs']}]:[])];
const outDir=path.join(root,'.verification-runs','t09-'+scope+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);
const controller=new AbortController(),stop=()=>controller.abort();
process.once('SIGINT',stop);process.once('SIGTERM',stop);
runChecks({steps,cwd:root,outDir,env:{...process.env,PYTHONPATH:path.join(root,'services/api'),PYTHONDONTWRITEBYTECODE:'1'},signal:controller.signal})
 .then(r=>{console.log('T09 '+scope+' automatic checks: '+r.status+'; external checks: not run');console.log('Result: '+path.join(outDir,'result.json'));process.exitCode=controller.signal.aborted?130:r.status==='passed'?0:1})
 .catch(e=>{console.error(e.message);process.exitCode=1})
 .finally(()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop)});
