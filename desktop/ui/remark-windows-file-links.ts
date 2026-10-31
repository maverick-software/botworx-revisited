import {documentOutputPath,documentOutputHref} from '../src/document-output-links';
type MarkdownNode={type:string;value?:string;url?:string;children?:MarkdownNode[]};

// Models sometimes emit [name](C:\Folder With Spaces\file.docx). CommonMark
// leaves that destination as text, so ChatLink never receives it. Repair only
// literal drive-absolute links in prose. Standalone document paths in inline
// code become file links; fenced examples and existing links stay intact.
export function remarkWindowsFileLinks(){
 return (tree:MarkdownNode)=>{
  function walk(parent:MarkdownNode){
   if(!parent.children||['link','linkReference','image','imageReference','code','inlineCode','html'].includes(parent.type))return;
   const next:MarkdownNode[]=[];
   for(const node of parent.children){
    if(node.type==='inlineCode'&&node.value&&documentOutputPath(node.value)){
     next.push({type:'link',url:documentOutputHref(node.value),children:[{type:'text',value:node.value.split(/[\\/]/).at(-1)!}]});continue;
    }
    if(node.type!=='text'||!node.value){walk(node);next.push(node);continue;}
    const text=node.value,pattern=/\[([^\]\n]+)\]\((?=[a-z]:[\\/])/gi;let previous=0,match:RegExpExecArray|null;
    while((match=pattern.exec(text))){
     if(match.index>0&&text[match.index-1]==='!')continue;
     const start=pattern.lastIndex;let end=start,depth=1;
     for(;end<text.length;end++){const c=text[end];if(c==='\n'||c==='\r')break;if(c==='(')depth++;if(c===')'&&--depth===0)break;}
     if(depth!==0)continue;
     const path=text.slice(start,end);
     if(path.length>4000||/[\x00-\x1f\x7f<>"|?*]/.test(path))continue;
     // Keep the exact separators offered in the saved reply. The file resolver
     // verifies that reply before granting access to a generated document.
     const url=path.slice(0,3)+path.slice(3).split(/([\\/])/).map(part=>part==='\\'||part==='/'?part:encodeURIComponent(part)).join('');
     if(match.index>previous)next.push({type:'text',value:text.slice(previous,match.index)});
     next.push({type:'link',url,children:[{type:'text',value:match[1]}]});
     previous=end+1;pattern.lastIndex=previous;
    }
    if(previous===0)next.push(node);else if(previous<text.length)next.push({type:'text',value:text.slice(previous)});
   }
   parent.children=next;
  }
  walk(tree);
 };
}
