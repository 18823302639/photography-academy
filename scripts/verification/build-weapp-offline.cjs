// Use Taro's installed schema, then compile without repeating its remote-schema check.
// No dependencies are fetched. This does not disable the local configuration validation.
const path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process');
const esbuild=require('esbuild');
const {validateConfig}=require('@tarojs/plugin-doctor/js-binding');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'apps/miniprogram');
async function main(){
 const file=path.join(app,'config/index.ts');
 const result=esbuild.buildSync({entryPoints:[file],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
 const configModule=new Module(file,module);configModule.filename=file;configModule.paths=Module._nodeModulePaths(path.dirname(file));
 configModule._compile(result.outputFiles[0].text,file);
 const config=configModule.exports.default;
 if(!config||typeof config!=='object')throw Error('Offline build expects the current object-based Taro config');
 // Fail closed if the installed validator no longer rejects a known invalid config.
 const invalid=await validateConfig(JSON.stringify({designWidth:'invalid'}),'',false);
 if(invalid.isValid)throw Error('Local Taro schema self-check failed');
 const checked=await validateConfig(JSON.stringify(config,(_,value)=>typeof value==='function'?'__function__':value),'',false);
 if(!checked.isValid)throw Error('Local Taro schema rejected config: '+checked.messages.map(m=>m.content).join('; '));
 console.log('PASS installed Taro schema: invalid-config control rejected and project config accepted; remote schema disabled.');
 const cli=path.join(path.dirname(require.resolve('@tarojs/cli/package.json')),'bin/taro');
 // --no-check only suppresses the duplicate remote-backed check above. The local check must pass first.
 const built=spawnSync(process.execPath,[cli,'build','--type','weapp','--no-check'],{cwd:app,env:process.env,stdio:'inherit'});
 if(built.error)throw built.error;
 if(built.signal)throw Error('Build interrupted: '+built.signal);
 process.exitCode=built.status??1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>esbuild.stop());
