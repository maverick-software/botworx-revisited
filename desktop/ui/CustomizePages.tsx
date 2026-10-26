import React from 'react';
import type {ChatSettingsContext} from './CapabilitySettings';
import {SkillsLibrary} from './SkillsLibrary';
export function SkillsPage({owner,context}:{owner:string;context:ChatSettingsContext;manage:()=>void}){return <SkillsLibrary owner={owner} context={context}/>;}
