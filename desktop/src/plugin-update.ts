import type {PluginPackage} from './plugin-contracts';
import {pluginDigest,validatePluginPackage} from './plugin-validation';

export type PluginUpdatePlan={previousDigest:string;digest:string;fromVersion:string;toVersion:string;preservedServers:string[];addedServers:string[];changedServers:string[];removedServers:string[];addedFiles:string[];changedFiles:string[];removedFiles:string[]};
export function planPluginUpdate(previous:PluginPackage,value:unknown):{package:PluginPackage;update:PluginUpdatePlan}{
 const old=validatePluginPackage(previous),next=validatePluginPackage(value);
 if(old.manifest.name!==next.manifest.name)throw new Error('An update must keep the installed plugin name.');
 if(old.manifest.version===next.manifest.version)throw new Error('Use a different version for a plugin update.');
 const before=old.mcp?.mcpServers??{},after=next.mcp?.mcpServers??{},oldFiles=old.files??{},newFiles=next.files??{};
 return {package:next,update:{previousDigest:pluginDigest(old),digest:pluginDigest(next),fromVersion:old.manifest.version,toVersion:next.manifest.version,
  preservedServers:Object.keys(after).filter(name=>before[name]?.url===after[name].url&&before[name]?.type===after[name].type).sort(),
  addedServers:Object.keys(after).filter(name=>!before[name]).sort(),changedServers:Object.keys(after).filter(name=>before[name]&&(before[name].url!==after[name].url||before[name].type!==after[name].type)).sort(),
  removedServers:Object.keys(before).filter(name=>!after[name]).sort(),addedFiles:Object.keys(newFiles).filter(name=>!(name in oldFiles)).sort(),
  changedFiles:Object.keys(newFiles).filter(name=>name in oldFiles&&oldFiles[name]!==newFiles[name]).sort(),removedFiles:Object.keys(oldFiles).filter(name=>!(name in newFiles)).sort()}};
}
