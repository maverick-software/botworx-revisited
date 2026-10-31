import React from 'react';
import {ArrowLeft,ArrowRight,PanelLeft} from 'lucide-react';
import {call} from './ui';
export function DesktopBar({back,forward,canBack,canForward,sidebar}:{back:()=>void;forward:()=>void;canBack:boolean;canForward:boolean;sidebar?:()=>void}){
 return <header className="desktop-bar" aria-label="Desktop navigation"><div className="desktop-bar-safe"><button className="icon-button" aria-label="Go back" title="Back (Alt+Left)" disabled={!canBack} onClick={back}><ArrowLeft size={16}/></button><button className="icon-button" aria-label="Go forward" title="Forward (Alt+Right)" disabled={!canForward} onClick={forward}><ArrowRight size={16}/></button>{sidebar&&<button className="icon-button" aria-label="Toggle chat sidebar" title="Toggle sidebar (Ctrl+B)" onClick={sidebar}><PanelLeft size={16}/></button>}<nav aria-label="Application menus">{['File','Edit','View','Help'].map(kind=><button key={kind} onClick={()=>void call('window.menu',{kind:kind.toLowerCase()})}>{kind}</button>)}</nav><span className="desktop-bar-title">Sylvana</span></div></header>;
}
