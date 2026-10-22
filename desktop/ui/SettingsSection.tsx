import React from 'react';
import {Modal} from './ui';

// Configuration can be embedded in Settings without opening a second dialog.
export function SettingsSection({inline,title,close,className='',children}:{inline?:boolean;title:string;close:()=>void;className?:string;children:React.ReactNode}){
 return inline?<div className={'settings-capability '+className}>{children}</div>:<Modal title={title} close={close} className={className}>{children}</Modal>;
}
