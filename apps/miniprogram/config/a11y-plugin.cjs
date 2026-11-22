// Local Taro plugin: use the installed platform's setup hook to bind supported native attributes.
// No dependencies or generated dist files are patched in place.
module.exports=ctx=>{
 ctx.registerMethod('onSetupClose',platform=>{
  if(platform.platform!=='weapp')return;
  const template=platform.template,original=template?.modifyTemplateResult;
  if(!template)throw Error('Native accessibility template is unavailable');
  template.modifyTemplateResult=function(markup,nodeName,...args){
   const result=original?original.call(this,markup,nodeName,...args):markup;
   const tag=nodeName==='static-image'?'image':nodeName;
   if(tag!=='textarea'&&tag!=='image')return result;
   // Unknown JSX props are serialized as their camelCase names by Taro hydrate().
   // Bind that raw property without changing aliases used by src/value or platform runtime.
   return result.replace(new RegExp('<'+tag+'(?=\\s)','g'),'<'+tag+' aria-label="{{i.ariaLabel}}"');
  };
 });
};
