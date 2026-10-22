import type {SaxesTagNS} from 'saxes';
type XML=(bytes:Uint8Array,open?:(node:SaxesTagNS)=>void,text?:(value:string)=>void,close?:(node:SaxesTagNS)=>void)=>void;
const attr=(n:SaxesTagNS,key:string)=>Object.values(n.attributes).find(a=>a.local===key)?.value??'';
const column=(s:string)=>[...s.toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
const letters=(n:number):string=>n>26?letters(Math.floor((n-1)/26))+String.fromCharCode(65+(n-1)%26):String.fromCharCode(64+n);
function position(value:string){const m=/^(\$?)([A-Z]{1,3})(\$?)([1-9]\d{0,6})$/i.exec(value);if(!m)return;const c=column(m[2]),r=Number(m[4]);return c<=16384&&r<=1048576?{row:r,column:c,fixedColumn:!!m[1],fixedRow:!!m[3]}:undefined;}
function span(value:string){const bits=value.split(':');if(bits.length>2)return;const first=position(bits[0]),last=position(bits[1]??bits[0]);return first&&last&&first.row<=last.row&&first.column<=last.column?{first,last}:undefined;}
function translatedRange(token:string,rows:number,columns:number):string{
 const bang=token.lastIndexOf('!'),prefix=bang>=0?token.slice(0,bang+1):'',range=token.slice(bang+1);
 // Structured references and external-workbook qualifiers stay literal. Only
 // the A1 range after the last sheet qualifier is translated, never fetched.
 if(!range||range.includes('[')||range.includes(']'))return token;
 const moveRow=(s:string)=>s.startsWith('$')?s:Number(s)+rows<1||Number(s)+rows>1048576?'#REF!':String(Number(s)+rows);
 const moveCol=(s:string)=>{if(s.startsWith('$'))return s;const c=column(s)+columns;return c<1||c>16384?'#REF!':letters(c);};
 const rowRange=/^(\$?[1-9]\d{0,6}):(\$?[1-9]\d{0,6})$/.exec(range),colRange=/^(\$?[A-Z]{1,3}):(\$?[A-Z]{1,3})$/i.exec(range);
 if(rowRange&&rowRange.slice(1).every(s=>Number(s.replace('$',''))<=1048576))return prefix+moveRow(rowRange[1])+':'+moveRow(rowRange[2]);
 if(colRange&&colRange.slice(1).every(s=>column(s.replace('$',''))<=16384))return prefix+moveCol(colRange[1])+':'+moveCol(colRange[2]);
 if(range.includes(':'))return prefix+range.split(':').map(piece=>translatedRange(piece,rows,columns)).join(':');
 const p=position(range);if(!p)return token;
 const r=p.row+(p.fixedRow?0:rows),c=p.column+(p.fixedColumn?0:columns);
 return prefix+(r<1||r>1048576||c<1||c>16384?'#REF!':(p.fixedColumn?'$':'')+letters(c)+(p.fixedRow?'$':'')+r);
}
/** Translate A1 references without evaluating expressions or touching strings. */
export function translateSharedFormula(formula:string,rows:number,columns:number):string|undefined{
 if(formula.length>160000||!Number.isSafeInteger(rows)||!Number.isSafeInteger(columns))return;
 let out='',token='',brackets=0;
 const flush=(isFunction=false)=>{if(!token)return;const implicit=token.startsWith('@')?'@':'',spill=token.endsWith('#')?'#':'';out+=isFunction?token:implicit+translatedRange(token.slice(implicit.length,spill?-1:undefined),rows,columns)+spill;token='';};
 for(let i=0;i<formula.length;i++){
  const c=formula[i];
  if(c==='"'&&!brackets){flush();let end=i+1;for(;end<formula.length;end++)if(formula[end]==='"'){if(formula[end+1]==='"'){end++;continue;}break;}if(end===formula.length)return;out+=formula.slice(i,end+1);i=end;continue;}
  if(c==="'"&&!brackets){let end=i+1;for(;end<formula.length;end++)if(formula[end]==="'"){if(formula[end+1]==="'"){end++;continue;}break;}if(end===formula.length)return;token+=formula.slice(i,end+1);i=end;continue;}
  if(c==='[')brackets++;if(c===']'&&--brackets<0)return;
  if(brackets||c===']'){token+=c;continue;}
  if(/[+\-*/^&=><%(),;{}\s]/.test(c)){flush(c==='('||!!token&&/\s/.test(c)&&/^\s*\(/.test(formula.slice(i)));out+=c;}else token+=c;
 }
 if(brackets)return;flush();return out.length<=160000?out:undefined;
}

/** A worksheet prepass supports masters appearing after their followers. */
export function sharedFormulas(bytes:Uint8Array,xml:XML,maxCharacters=2000000){
 type Entry={address:string;index:string;formula:string;ref:string;shared:boolean};
 const cells=new Map<string,Entry>(),groups=new Map<string,Entry|null>();let current:Entry|undefined,inFormula=false,count=0,remaining=maxCharacters;
 xml(bytes,n=>{if(n.local==='c'){current={address:attr(n,'r'),index:'',formula:'',ref:'',shared:false};inFormula=false;}if(n.local==='f'&&current&&attr(n,'t')==='shared'){current.shared=true;current.index=attr(n,'si');current.ref=attr(n,'ref');inFormula=true;}},text=>{if(inFormula&&current)current.formula+=text;},n=>{
  if(n.local==='f')inFormula=false;
  if(n.local==='c'&&current){if(current.shared){if(++count>100000)throw Error('Too many shared formula cells');cells.set(current.address,current);if(current.formula){if(groups.has(current.index))groups.set(current.index,null);else groups.set(current.index,current);}}current=undefined;}
 });
 return {resolve(address:string):{formula?:string;unavailable?:boolean}|undefined{
  const entry=cells.get(address);if(!entry)return;
  if(entry.formula)return {formula:entry.formula.slice(0,160000)};
  const master=/^\d{1,10}$/.test(entry.index)?groups.get(entry.index):undefined,origin=master&&position(master.address),target=position(address),range=master&&span(master.ref);
  if(!master||!origin||!target||!range||origin.row<range.first.row||origin.row>range.last.row||origin.column<range.first.column||origin.column>range.last.column||target.row<range.first.row||target.row>range.last.row||target.column<range.first.column||target.column>range.last.column)return {unavailable:true};
  const formula=translateSharedFormula(master.formula,target.row-origin.row,target.column-origin.column);
  if(formula===undefined||formula.length>remaining)return {unavailable:true};remaining-=formula.length;return {formula};
 }};
}
