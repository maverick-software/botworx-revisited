import {browserDomChecks} from './browser-dom';
export const browserKeys={Enter:{key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},Tab:{key:'Tab',code:'Tab',windowsVirtualKeyCode:9},Escape:{key:'Escape',code:'Escape',windowsVirtualKeyCode:27},ArrowUp:{key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38},ArrowDown:{key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40},ArrowLeft:{key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37},ArrowRight:{key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},Home:{key:'Home',code:'Home',windowsVirtualKeyCode:36},End:{key:'End',code:'End',windowsVirtualKeyCode:35},PageUp:{key:'PageUp',code:'PageUp',windowsVirtualKeyCode:33},PageDown:{key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34},Backspace:{key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8},Delete:{key:'Delete',code:'Delete',windowsVirtualKeyCode:46},Space:{key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '}};
export function browserKey(key:unknown,shift:unknown){if(typeof key!=='string'||!Object.hasOwn(browserKeys,key)||typeof shift!=='boolean')throw new Error('Choose a declared browser key and whether Shift is held.');return {...browserKeys[key as keyof typeof browserKeys],modifiers:shift?8:0};}
// These functions run in a dedicated isolated world. The page cannot replace
// their built-in DOM prototypes. Provider input never becomes executable code.
export const selectControlFunction=String.raw`function(labels,expected,apply){
 ${browserDomChecks}
 if(this.nodeName!=='SELECT'||!this.isConnected||this.matches(':disabled'))throw new Error('Choose an enabled native select control from a fresh snapshot.');
 if(this.options.length>10000)throw new Error('This dropdown exceeds the supported option limit.');
 if(!this.multiple&&labels.length!==1)throw new Error('A single-choice dropdown needs exactly one label.');
 const all=Array.from(this.options),chosen=labels.map(label=>{const matches=all.filter(option=>option.label===label);if(matches.length!==1)throw new Error('Each option label must match exactly one option in this dropdown.');const option=matches[0];if(option.matches(':disabled'))throw new Error('A chosen dropdown option is disabled.');return option;});
 const fingerprint=JSON.stringify({multiple:this.multiple,selected:all.flatMap((option,index)=>option.selected?[index]:[]),choices:chosen.map(option=>({index:all.indexOf(option),label:option.label,value:option.value}))});
 if(expected!==null&&fingerprint!==expected)throw new Error('The dropdown or its option values changed during review. Take a fresh snapshot.');
 if(apply){const box=Element.prototype.getBoundingClientRect.call(this);if(!box.width||!box.height||!targetHit(this,box.x+box.width/2,box.y+box.height/2))throw new Error('Another element covers the reviewed target. Take a fresh snapshot.');const set=Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype,'selected').set;for(const option of all)set.call(option,chosen.includes(option));this.dispatchEvent(new Event('input',{bubbles:true,composed:true}));this.dispatchEvent(new Event('change',{bubbles:true}));}
 return {fingerprint,labels:chosen.map(option=>option.label)};
}`;
export const keyboardTargetFunction=String.raw`function(focused,editing){
 ${browserDomChecks}
 if(!this.isConnected||this.matches(':disabled'))throw new Error('The keyboard target is no longer available.');
 if(['INPUT','TEXTAREA'].includes(this.nodeName)){const type=(this.getAttribute('type')||'text').toLowerCase(),autocomplete=this.getAttribute('autocomplete')||'';if(['password','file','hidden'].includes(type)||/(?:password|one-time-code|cc-)/i.test(autocomplete))throw new Error('Password, payment, upload and verification fields need manual entry.');if(editing&&this.readOnly)throw new Error('This keyboard target is read-only.');}
 if(editing&&this.getAttribute('aria-readonly')==='true')throw new Error('This keyboard target is read-only.');
 if(focused&&!targetFocused(this))throw new Error('The reviewed keyboard target lost focus. Take a fresh snapshot.');return true;
}`;

export const uploadControlFunction=String.raw`function(count,kind){
 if(this.nodeName!=='INPUT'||this.type!=='file'||!this.isConnected)throw new Error('Choose a current file input from the snapshot file_inputs list.');
 if(this.ownerDocument!==document)throw new Error('File inputs inside frames need their own reviewed browser context.');
 const root=Node.prototype.getRootNode.call(this),label=(this.getAttribute('aria-label')||(this.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>root.getElementById(id)?.textContent||'').join(' ').trim()||Array.from(this.labels||[],label=>label.textContent||'').join(' ').trim()||this.name||this.id||'File upload').slice(0,240),form=this.form,action=form?form.action:'',accept=this.accept||'',disabled=this.matches(':disabled'),directory=this.hasAttribute('webkitdirectory')||this.hasAttribute('directory'),box=Element.prototype.getBoundingClientRect.call(this),hidden=!box.width||!box.height||getComputedStyle(this).visibility==='hidden';
 const description={name:label,multiple:this.multiple,accept:accept.slice(0,1000),hidden,disabled,directory,form_action:action.slice(0,4000)};
 if(count===null)return description;
 if(disabled)throw new Error('Choose an enabled file input.');if(directory&&count>0&&kind!=='folder')throw new Error('Use browser_upload_folder for this directory picker.');if(!directory&&kind==='folder')throw new Error('Choose a directory picker for a folder upload.');
 if(count>1&&!this.multiple&&!directory)throw new Error('This file input accepts only one file.');
 if(action.length>4000||accept.length>1000||(this.files?.length||0)>1000)throw new Error('This file input exceeds the supported review limits.');
 return {...description,fingerprint:JSON.stringify({label,multiple:this.multiple,accept,action,method:form?.method||'',target:form?.target||'',name:this.name,disabled,directory,files:Array.from(this.files||[],file=>({name:file.name,size:file.size,type:file.type,modified:file.lastModified,relativePath:file.webkitRelativePath}))})};
}`;

export const clearUploadControlFunction=String.raw`function(){if(this.nodeName!=='INPUT'||this.type!=='file'||!this.isConnected||this.matches(':disabled'))throw new Error('The upload field changed. Take a fresh snapshot.');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(this,'');this.dispatchEvent(new Event('input',{bubbles:true,composed:true}));this.dispatchEvent(new Event('change',{bubbles:true}));return this.files.length;}`;

/** Directory selection is asynchronous; hold its visible native view until a fresh change is observed. */
export const directoryUploadStateFunction=String.raw`function(action,key,expected){
 if(action==='begin'){const target=this,record={target,changed:false,listener:null};record.listener=event=>{if(event.isTrusted)record.changed=true;};target.addEventListener('change',record.listener);Object.defineProperty(globalThis,key,{value:record,configurable:true});return true;}
 const record=globalThis[key];if(!record||record.target!==this)throw new Error('The directory upload control changed after dispatch. Inspect the site before retrying.');
 if(action==='clear'){this.removeEventListener('change',record.listener);delete globalThis[key];return true;}
 if(!record.changed)return false;
 const actual=Array.from(this.files||[],file=>({path:file.webkitRelativePath,name:file.name,size:file.size})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return JSON.stringify(actual.map(file=>[file.path,file.name,file.size]))===JSON.stringify(expected.map(file=>[file.path,file.name,file.size]));
}`;
