import React from 'react';
import {Modal} from './ui';

// Configuration can be embedded in Settings without opening a second dialog.
export function SettingsSection({inline,title,close,className='',children,overlayClassName}:{inline?:boolean;title:string;close:()=>void;className?:string;overlayClassName?:string;children:React.ReactNode}){
 return inline?<div className={'settings-capability '+className}>{children}</div>:<Modal title={title} close={close} className={className} overlayClassName={overlayClassName}>{children}</Modal>;
}
