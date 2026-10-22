import React,{useRef} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {X} from 'lucide-react';
import {defaultDesktopPreferences,type DesktopBridge,type DesktopPreferences,type ProviderStatus} from '../src/contracts';
declare global {interface Window {agentopia:DesktopBridge}}
export const call=<T,>(action:string,args?:Record<string,unknown>)=>window.agentopia.call<T>(action,args);
export type Connections=ProviderStatus;
export function Modal({title,close,children,className=''}:{title:string;close:()=>void;children:React.ReactNode;className?:string}){
 const returnTo=useRef(document.activeElement as HTMLElement|null);
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content aria-describedby={undefined} className={'modal '+className} onCloseAutoFocus={event=>{event.preventDefault();if(returnTo.current?.isConnected)returnTo.current.focus();}}><div className="modal-header"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Close dialog"><X size={20}/></button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Menu({trigger,children,align='start',open,onOpenChange,onCloseAutoFocus}:{trigger:React.ReactElement;children:React.ReactNode;align?:'start'|'center'|'end';open?:boolean;onOpenChange?:(open:boolean)=>void;onCloseAutoFocus?:(event:Event)=>void}){
 return <Dropdown.Root modal={false} open={open} onOpenChange={onOpenChange}><Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger><Dropdown.Portal><Dropdown.Content onCloseAutoFocus={onCloseAutoFocus} className="menu-content" align={align} sideOffset={7} collisionPadding={12}>{children}</Dropdown.Content></Dropdown.Portal></Dropdown.Root>;
}
export function MenuItem({children,onSelect,danger=false,disabled=false}:{children:React.ReactNode;onSelect:()=>void;danger?:boolean;disabled?:boolean}){
 return <Dropdown.Item className={'menu-item '+(danger?'danger':'')} disabled={disabled} onSelect={onSelect}>{children}</Dropdown.Item>;
}
export const MenuSeparator=()=> <Dropdown.Separator className="menu-separator"/>;
export type Preferences=DesktopPreferences;
export const defaultPreferences=defaultDesktopPreferences;
