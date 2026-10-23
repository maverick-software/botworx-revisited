import {Node} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import type {ToolSource} from '../src/tool-contracts';
import {instructionAppAt,instructionAppId,instructionAppLabel,instructionAppMarkdown} from '../src/instruction-app-references';

export const InstructionAppMention=Node.create<{sources:()=>ToolSource[]|null}>({
 name:'instructionAppMention',group:'inline',inline:true,atom:true,selectable:true,draggable:false,
 addOptions(){return {sources:()=>null};},
 addAttributes(){return {source:{default:''},label:{default:''}};},
 parseHTML(){return [{tag:'span[data-instruction-app]',getAttrs:element=>{const source=element.getAttribute('data-instruction-app'),label=element.getAttribute('data-app-label')??'';return instructionAppId(source)&&instructionAppLabel(label)?{source,label}:false;}}];},
 renderHTML({node}){return ['span',{'data-instruction-app':node.attrs.source,'data-app-label':node.attrs.label,class:'instruction-app-mention'},'@'+node.attrs.label];},
 renderText({node}){return '@'+node.attrs.label;},
 addKeyboardShortcuts(){return {'Mod-End':()=>this.editor.commands.focus('end'),'Mod-Home':()=>this.editor.commands.focus('start'),Backspace:()=>{const selection=this.editor.state.selection,node=selection.$from.nodeBefore;if(!selection.empty||node?.type.name!==this.name)return false;return this.editor.commands.deleteRange({from:selection.from-node.nodeSize,to:selection.from});},Delete:()=>{const selection=this.editor.state.selection,node=selection.$from.nodeAfter;if(!selection.empty||node?.type.name!==this.name)return false;return this.editor.commands.deleteRange({from:selection.from,to:selection.from+node.nodeSize});}};},
 markdownTokenName:'instructionAppMention',
 markdownTokenizer:{name:'instructionAppMention',level:'inline',start:'[@',tokenize:source=>{const value=instructionAppAt(source);return value?{type:'instructionAppMention',raw:source.slice(0,value.to),source:value.id,label:value.label}:undefined;}},
 parseMarkdown(token){return {type:'instructionAppMention',attrs:{source:token.source,label:token.label}};},
 renderMarkdown(node){return instructionAppMarkdown(node.attrs!.source,node.attrs!.label);},
 addNodeView(){return ({node:initial})=>{let node=initial;const dom=document.createElement('span');dom.contentEditable='false';const render=()=>{const source=this.options.sources()?.find(row=>row.id===node.attrs.source&&row.enabled);dom.dataset.instructionApp=node.attrs.source;dom.dataset.appLabel=node.attrs.label;dom.className='instruction-app-mention';dom.textContent='@'+(source?instructionAppLabel(source.name):node.attrs.label);};render();return {dom,update:next=>{if(next.type!==node.type)return false;node=next;render();return true;}};};},
 addProseMirrorPlugins(){return [new Plugin({props:{decorations:state=>{const sources=this.options.sources(),decorations:Decoration[]=[];state.doc.descendants((node,position)=>{if(node.type.name!==this.name)return;const source=sources?.find(row=>row.id===node.attrs.source&&row.enabled),status=sources===null?'loading':source?(source.ready?'ready':'reconnect'):'unavailable';decorations.push(Decoration.node(position,position+node.nodeSize,{'data-app-state':status,title:(source?instructionAppLabel(source.name)+' · ':'')+({loading:'Checking assigned apps',ready:'Connected',reconnect:'Connection required',unavailable:'App unavailable or no longer assigned'}[status])}));});return DecorationSet.create(state.doc,decorations);}}})];},
});
