import {createHash} from 'node:crypto';
import {composioMcpAuth,composioMcpUrl,isComposioServicePluginName} from './composio-mcp-contracts';
import {pluginSchemaUrl,mcpSchemaUrl,type PluginPackage} from './plugin-contracts';
import {composioServiceSlug as accountServiceSlug,composioReservedToolkits} from './composio-account-contracts';

const prefix='composio-service-';
const canonical=(value:unknown):string=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function composioServiceSlug(value:unknown):string{
 const slug=accountServiceSlug(value);if(composioReservedToolkits.has(slug))throw Error('Platform management tools cannot be agent capabilities.');return slug;
}
/** Package names are short and collision-resistant even for provider slugs with underscores. */
export function composioServicePluginName(slug:string){return prefix+createHash('sha256').update(composioServiceSlug(slug)).digest('hex').slice(0,32);}
export {isComposioServicePluginName} from './composio-mcp-contracts';
export function composioServiceConnectionId(plugin:string){
 if(!isComposioServicePluginName(plugin))throw Error('Choose a Composio service capability.');
 const hash=createHash('sha256').update('sylvana-composio-service-v1:'+plugin).digest('hex');
 return hash.slice(0,8)+'-'+hash.slice(8,12)+'-8'+hash.slice(13,16)+'-'+((parseInt(hash[16],16)&3)|8).toString(16)+hash.slice(17,20)+'-'+hash.slice(20,32);
}
/** Only trusted catalog synchronization installs these packages. They contain no account or secret. */
export function composioServicePackage(slug:string,title:string):PluginPackage{
 composioServiceSlug(slug);
 if(typeof title!=='string'||!title.trim()||title!==title.trim()||title.length>80||/[\x00-\x1f\x7f]/.test(title))throw Error('The Composio service needs a readable name.');
 return {manifest:{$schema:pluginSchemaUrl,name:composioServicePluginName(slug),version:'1.0.0',description:'Use '+title+' through this account\u2019s Composio connection.',author:{name:'Sylvana'},extensions:{'com.sylvana':{composioToolkit:slug},'com.openai':{interface:{displayName:title,shortDescription:'Connected through Composio'}}}},mcp:{$schema:mcpSchemaUrl,mcpServers:{service:{type:'streamable-http',url:composioMcpUrl,extensions:{'com.openai':{auth:composioMcpAuth}}}}}};
}
/** Imported declarations cannot gain service authority by copying a name or endpoint. */
export function composioServicePackageSlug(pkg:PluginPackage):string|undefined{
 const slug=pkg?.manifest?.extensions?.['com.sylvana']?.composioToolkit;
 if(slug===undefined)return;
 const title=pkg.manifest.extensions?.['com.openai']?.interface;
 if(!title||typeof title!=='object'||typeof (title as {displayName?:unknown}).displayName!=='string')throw Error('The Composio service capability differs from its pinned declaration.');
 const expected=composioServicePackage(composioServiceSlug(slug),(title as {displayName:string}).displayName);
 if(canonical(pkg)!==canonical(expected))throw Error('The Composio service capability differs from its pinned declaration.');
 return slug as string;
}
export function composioServiceTitle(pkg:PluginPackage):string|undefined{return composioServicePackageSlug(pkg)?(pkg.manifest.extensions!['com.openai'].interface as {displayName:string}).displayName:undefined;}
