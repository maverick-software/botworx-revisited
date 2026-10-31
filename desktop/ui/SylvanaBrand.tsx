import React from 'react';
import symbol from './assets/sylvana-symbol-white.png';
export function SylvanaBrand({className='',symbolOnly=false}:{className?:string;symbolOnly?:boolean}){return <span className={'sylvana-brand '+className} role="img" aria-label="Sylvana"><span className="sylvana-brand-symbol" aria-hidden="true" style={{maskImage:`url(${symbol})`}}/>{!symbolOnly&&<span className="sylvana-brand-wordmark" aria-hidden="true">sylvana</span>}</span>;}
