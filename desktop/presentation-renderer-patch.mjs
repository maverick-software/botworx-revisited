import {createHash} from 'node:crypto';
const expected='4cd4b466a622bb0fbecee258e05ad1f574cb6f4f202091515de30bcef63e4e14';
const before='b = y.exists() ? yn(y) : x, $ = Py(i, { darken: !o });';
const chartFontBefore='a !== void 0 && a > 0 && (n.fontSize = Math.round(a / 100), n[yr] = !0);';
const chartFormatBefore='function Vt(e, t) {\n  if (!t || t === "General")';
const chartLabelBefore='position: rx(Le.position, h),';
const chartLayoutBefore='Ax(l, e.size), s &&';

// This function is injected into the pinned renderer, where chartNode is its
// existing namespace-aware XML wrapper. Keep it independent of Node APIs.
export function preserveHorizontalBarChartLayout(option,chartNode){
 const plot=chartNode.child('chart').child('plotArea'),bars=plot.children('barChart');
 if(bars.length!==1||bars[0].child('barDir').attr('val')!=='bar'||Array.isArray(option.xAxis)||Array.isArray(option.yAxis)||!option.xAxis||!option.yAxis)return;
 if(plot.child('layout').child('manualLayout').exists())return;
 const valueId=bars[0].children('axId')[1]?.attr('val'),axis=plot.children('valAx').find(node=>node.child('axId').attr('val')===valueId);
 if(!axis||axis.child('crossesAt').exists())return;
 const crossing=axis.child('crosses').attr('val')??'autoZero';
 if(!['autoZero','min','max'].includes(crossing))return;
 const x=option.xAxis,top=(crossing==='max')!==!!option.yAxis.inverse;
 x.position=top?'top':'bottom';
 if(!x.name||x.nameLocation!=='middle'||!option.grid||Array.isArray(option.grid))return;
 const defaults=chartNode.child('txPr').children('p').map(node=>node.child('pPr').child('defRPr').numAttr('sz')).find(value=>Number.isFinite(value)&&value>0);
 x.nameTextStyle={...x.nameTextStyle};
 if(x.nameTextStyle.fontSize===undefined&&defaults)x.nameTextStyle.fontSize=defaults/100*(96/72);
 const nameFont=x.nameTextStyle.fontSize??12,tickFont=x.axisLabel?.fontSize??10,gap=x.nameGap??42,title=Array.isArray(option.title)?option.title[0]:option.title;
 const titleSpace=top&&title?.text&&title.show!==false?(title.textStyle?.fontSize??18)*1.4+8:0;
 const required=Math.ceil(titleSpace+gap+nameFont*1.2+tickFont+8),edge=top?'top':'bottom';
 // Keep explicit percentage-based layout decisions intact. Native automatic
 // placement needs room for both the axis name and its readable tick labels.
 if(option.grid[edge]===undefined||typeof option.grid[edge]==='number')option.grid[edge]=Math.max(option.grid[edge]??0,required);
}
export function preservePowerPointColumnColors(code){
 if(createHash('sha256').update(code).digest('hex')!==expected||code.split(before).length!==2)throw Error('The pinned presentation renderer changed. Recheck the native color comparison before building.');
 return code.replace(before,'b = y.exists() ? yn(y) : x, $ = Py(i, { darken: !1 });');
}
export function preservePowerPointChartFormatting(code){
 const colors=preservePowerPointColumnColors(code);
 if([chartFontBefore,chartFormatBefore,chartLabelBefore,chartLayoutBefore].some(before=>colors.split(before).length!==2))throw Error('The pinned chart text, layout or number formatter changed. Requalify against native PowerPoint.');
 // Chart text uses the same hundredths-of-a-point units as the surrounding
 // slide text. ECharts expects CSS pixels; the upstream chart-default parser
 // already applies this conversion, but explicit chart runs omitted it.
 const fonts=colors.replace(chartFontBefore,'a !== void 0 && a > 0 && (n.fontSize = a / 100 * (96 / 72), n[yr] = !0);');
 // Reuse the Office number formatter already included for spreadsheets. It
 // retains quoted currency, precision, grouping, and positive/negative sections.
 // Unsupported formats keep the upstream fallback instead of breaking a slide.
 const layout=fonts.replace(chartLabelBefore,'position: o && Le.position === "outEnd" ? "outside" : rx(Le.position, h),').replace(chartLayoutBefore,'preserveHorizontalBarChartLayout(l, i), Ax(l, e.size), s &&');
 return "import {format as agentopiaOfficeNumberFormat} from 'ssf';\n"+preserveHorizontalBarChartLayout.toString()+'\n'+layout.replace(chartFormatBefore,'function Vt(e, t) {\n  if (t && t !== "General") {\n    try { const formatted = agentopiaOfficeNumberFormat(t, e); if (typeof formatted === "string") return formatted; } catch {}\n  }\n  if (!t || t === "General")');
}
export function presentationRendererPatch(){let applied=false;return {name:'agentopia-native-presentation-formatting',enforce:'pre',buildStart(){applied=false;},transform(code,id){if(!id.replaceAll('\\','/').endsWith('/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.es.js'))return;const patched=preservePowerPointChartFormatting(code);applied=true;return {code:patched,map:null};},generateBundle(){if(!applied)throw Error('The native presentation color correction was not applied. Check the pinned renderer entry before building.');}};}
