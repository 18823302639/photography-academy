// Check emitted native templates, not the DOM adapter's interpretation of JSX.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'apps/miniprogram/dist');
// Installed Taro serializer seam. These compile-time feature flags are explicit for Node only.
for(const flag of ['ENABLE_INNER_HTML','ENABLE_ADJACENT_HTML','ENABLE_CLONE_NODE','ENABLE_SIZE_APIS','ENABLE_CONTAINS','ENABLE_MUTATION_OBSERVER','ENABLE_TEMPLATE_CONTENT','SUPPORT_TARO_POLYFILL'])global[flag]=false;
const {TaroElement,hydrate}=require('@tarojs/runtime');
for(const tag of ['textarea','image']){
 const element=new TaroElement(tag);element.setAttribute('ariaLabel','合成测试标签');
 assert.equal(hydrate(element).ariaLabel,'合成测试标签','real Taro serializer retains the raw label bound by native template');
}
const template=fs.readFileSync(path.join(dist,'base.wxml'),'utf8');
for(const tag of ['textarea','image']){
 const nodes=template.match(new RegExp('<'+tag+'\\s[^>]*>','g'))||[];
 assert.ok(nodes.length,'native '+tag+' templates exist');
 assert.ok(nodes.every(node=>/aria-label="\{\{i\.[\w]+\}\}"/.test(node)),'every native '+tag+' template binds aria-label to page data');
 assert.ok(nodes.every(node=>node.includes('aria-label="{{i.ariaLabel}}"')),'native labels use the unchanged runtime ariaLabel property, without changing component aliases');
}
const css=fs.readFileSync(path.join(dist,'app.wxss'),'utf8');
assert.ok(css.includes('.notice-error')&&css.includes('.notice-loading'),'native class-based status styles exist');
assert.ok(!/\[data-kind/.test(css),'status color does not depend on unsupported native dataset rendering');
console.log('PASS emitted native textarea/image accessibility bindings and class-based photo status styles (actual screen reader/layout still not tested).');
