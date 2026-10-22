import React,{useEffect,useRef} from 'react';

/** A one-pixel divider with a larger, invisible pointer target. */
export function ResizeBar({label,value,min,max,reverse=false,className='',measure,change,commit}:{label:string;value:number;min:number;max:number;reverse?:boolean;className?:string;measure?:()=>number;change:(value:number)=>void;commit?:(value:number)=>void}){
 const cleanup=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>cleanup.current?.(),[]);
 const clamp=(next:number)=>Math.round(Math.max(min,Math.min(max,next)));
 return <div className={'pane-resizer '+className} role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
  onKeyDown={event=>{
   const direction=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
   if(direction||event.key==='Home'||event.key==='End'){
    event.preventDefault();
    const actual=measure?.()??event.currentTarget.nextElementSibling?.getBoundingClientRect().width??value;
    const next=event.key==='Home'?min:event.key==='End'?max:clamp(actual+direction*(event.shiftKey?40:10)*(reverse?-1:1));
    change(next);commit?.(next);
   }
  }}
  onPointerDown={event=>{
   if(event.button!==0)return;
   event.preventDefault();cleanup.current?.();
   const node=event.currentTarget,start=event.clientX,actual=measure?.()??node.nextElementSibling?.getBoundingClientRect().width??value;
   node.focus();node.setPointerCapture(event.pointerId);node.dataset.resizing='true';document.body.classList.add('resizing-pane');
   let latest=clamp(actual);
   const move=(next:PointerEvent)=>{latest=clamp(actual+(next.clientX-start)*(reverse?-1:1));change(latest);};
   const stop=(event?:Event)=>{
    delete node.dataset.resizing;document.body.classList.remove('resizing-pane');
    node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',stop);node.removeEventListener('pointercancel',stop);node.removeEventListener('lostpointercapture',stop);
    cleanup.current=null;if(event)commit?.(latest);
   };
   cleanup.current=stop;node.addEventListener('pointermove',move);node.addEventListener('pointerup',stop);node.addEventListener('pointercancel',stop);node.addEventListener('lostpointercapture',stop);
  }}/>;
}
