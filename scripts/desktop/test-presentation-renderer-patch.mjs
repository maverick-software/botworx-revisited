import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {preservePowerPointColumnColors,presentationRendererPatch} from '../../desktop/presentation-renderer-patch.mjs';
import vm from 'node:vm';
import officeFormats from 'ssf';
import {preservePowerPointChartFormatting,preserveHorizontalBarChartLayout} from '../../desktop/presentation-renderer-patch.mjs';
const source=await readFile(new URL('../../node_modules/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.es.js',import.meta.url),'utf8');
test('the exact pinned renderer receives only the qualified default-column color correction',()=>{const patched=preservePowerPointColumnColors(source);assert.equal(patched.replace('b = y.exists() ? yn(y) : x, $ = Py(i, { darken: !1 });','b = y.exists() ? yn(y) : x, $ = Py(i, { darken: !o });'),source);});
test('changed or already patched dependency bytes require requalification',()=>{assert.throws(()=>preservePowerPointColumnColors(source+'\n'),/pinned presentation renderer changed/);assert.throws(()=>preservePowerPointColumnColors(preservePowerPointColumnColors(source)),/pinned presentation renderer changed/);});
test('a changed module entry cannot silently skip the correction',()=>{const plugin=presentationRendererPatch();plugin.buildStart();assert.equal(plugin.transform(source,'/other.js'),undefined);assert.throws(()=>plugin.generateBundle(),/was not applied/);assert(plugin.transform(source,'/fixture/node_modules/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.es.js').code.includes('darken: !1'));plugin.generateBundle();plugin.buildStart();assert.throws(()=>plugin.generateBundle(),/was not applied/);});

test('the actual patched chart formatter retains Office currency precision and format sections',()=>{
 const patched=preservePowerPointChartFormatting(source),start=patched.indexOf('function Vt(e, t) {'),end=patched.indexOf('\nfunction Pa(',start);assert(start>0&&end>start);
 const context={agentopiaOfficeNumberFormat:officeFormats.format,K1:()=>undefined};vm.createContext(context);vm.runInContext(patched.slice(start,end)+';globalThis.chartFormat=Vt;',context);
 for(const [value,pattern,expected]of [[376.5,'"$"#,##0.00','$376.50'],[171,'"$"#,##0.00','$171.00'],[1234.5,'"USD "#,##0.00','USD 1,234.50'],[-1234.5,'"$"#,##0.00;("$"#,##0.00)','($1,234.50)'],[0,'0.0;[Red]-0.0;"None"','None'],[.558,'0.0%','55.8%'],[1.25,'General','1.25']])assert.equal(context.chartFormat(value,pattern),expected);
 assert.equal(context.chartFormat(12.5,'[malformed'), '12.5','Unsupported formats preserve the upstream fallback');
});

const xmlNode=value=>({child:name=>xmlNode(Array.isArray(value?.[name])?value[name][0]:value?.[name]),children:name=>(value?.[name]===undefined?[]:Array.isArray(value[name])?value[name]:[value[name]]).map(xmlNode),attr:name=>value?.attributes?.[name],numAttr:name=>value?.attributes?.[name]===undefined?undefined:Number(value.attributes[name]),exists:()=>value!==undefined});
const chart=(extra={})=>xmlNode({chart:{plotArea:{barChart:{barDir:{attributes:{val:'bar'}},axId:[{attributes:{val:'-1'}},{attributes:{val:'-2'}}]},valAx:{axId:{attributes:{val:'-2'}},crosses:{attributes:{val:'autoZero'}},...extra.axis},...extra.plot}},txPr:{p:{pPr:{defRPr:{attributes:{sz:'1800'}}}}}});
const option=inverse=>({xAxis:{name:'Amount (USD)',nameLocation:'middle',nameGap:42,axisLabel:{fontSize:16}},yAxis:{inverse},title:{text:'Amount (USD)',textStyle:{fontSize:24}},grid:{top:61,bottom:0}});

test('reversed horizontal categories put the automatic currency axis above the bars with room for readable titles',()=>{
 const value=option(true);preserveHorizontalBarChartLayout(value,chart());assert.equal(value.xAxis.position,'top');assert.equal(value.xAxis.nameTextStyle.fontSize,24);assert(value.grid.top>=130);assert.equal(value.grid.bottom,0);
 const ordinary=option(false);preserveHorizontalBarChartLayout(ordinary,chart());assert.equal(ordinary.xAxis.position,'bottom');assert(ordinary.grid.bottom>=90);assert.equal(ordinary.grid.top,61);
});

test('explicit axis title sizes, manual plot placement and custom crossings are preserved',()=>{
 const sized=option(true);sized.xAxis.nameTextStyle={fontSize:30};preserveHorizontalBarChartLayout(sized,chart());assert.equal(sized.xAxis.nameTextStyle.fontSize,30);
 for(const xml of [chart({plot:{layout:{manualLayout:{}}}}),chart({axis:{crossesAt:{attributes:{val:'1.5'}}}})]){const value=option(true),before=structuredClone(value);preserveHorizontalBarChartLayout(value,xml);assert.deepEqual(value,before);}
});
