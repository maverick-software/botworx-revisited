import React from 'react';
import {createRoot} from 'react-dom/client';
import {DesktopApp} from './DesktopApp';
import './style.css';
createRoot(document.getElementById('root')!).render(<DesktopApp/>);
