import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
type Rect={x:number;y:number;width:number;height:number};
export type WindowState={bounds:Rect;maximized:boolean};
export function restoreWindow(value:unknown,areas:Rect[]):WindowState{
 const raw=value as Partial<WindowState>|null,b=raw?.bounds;
 const primary=areas[0]??{x:0,y:0,width:1360,height:900};
 if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k as keyof Rect])))return {bounds:{x:primary.x+Math.max(0,Math.floor((primary.width-1360)/2)),y:primary.y+Math.max(0,Math.floor((primary.height-900)/2)),width:Math.min(1360,primary.width),height:Math.min(900,primary.height)},maximized:false};
 const area=areas.find(a=>b.x>=a.x&&b.y>=a.y&&b.x+Math.min(b.width,160)<=a.x+a.width&&b.y+40<=a.y+a.height)??primary;
 const width=Math.max(Math.min(960,area.width),Math.min(b.width,area.width)),height=Math.max(Math.min(640,area.height),Math.min(b.height,area.height));
 return {bounds:{x:Math.round(Math.min(Math.max(b.x,area.x),area.x+area.width-width)),y:Math.round(Math.min(Math.max(b.y,area.y),area.y+area.height-height)),width:Math.round(width),height:Math.round(height)},maximized:raw?.maximized===true};
}
export async function loadWindow(directory:string,areas:Rect[]){let value:unknown;try{value=JSON.parse(await readFile(path.join(directory,'window.json'),'utf8'));}catch{}return restoreWindow(value,areas);}
export async function saveWindow(directory:string,state:WindowState){const file=path.join(directory,'window.json');await writeFile(file+'.tmp',JSON.stringify(state));await rename(file+'.tmp',file);}
