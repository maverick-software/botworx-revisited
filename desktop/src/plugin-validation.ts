import {createHash} from 'node:crypto';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/client/validators/ajv';
import manifestSchema from './plugin-schemas/plugin.schema.json';
import mcpSchema from './plugin-schemas/mcp.schema.json';
import {mcpAddress} from './mcp-client';
import {chromePluginName} from './chrome-contracts';
import {imageGenerationPluginName} from './image-generation-contracts';
import {pluginSchemaUrl,mcpSchemaUrl,type PluginPackage} from './plugin-contracts';
import {validatePluginSkillFiles,pluginSkillLimits} from './plugin-skill-files';
import {validateOpenAIPresentation} from './plugin-compatibility';
import {mcpOAuthDeclaration} from './mcp-oauth-declaration';
const validator=new AjvJsonSchemaValidator();
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const name=/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
function clean(value:unknown,depth=0):void{
 if(depth>24)throw new Error('The plugin declaration is nested too deeply.');
 if(Array.isArray(value)){for(const item of value)clean(item,depth+1);return;}
 if(record(value))for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('The plugin contains an unsafe property.');clean(item,depth+1);}
}
export function validatePluginPackage(value:unknown,bundled=false):PluginPackage{
 if(!record(value)||Object.keys(value).some(key=>!['manifest','mcp','files'].includes(key))||JSON.stringify(value).length>pluginSkillLimits.packageBytes)throw new Error('Provide a plugin package with manifest and optional MCP/skill files, smaller than 4 MB.');
 clean(value);
 const files=validatePluginSkillFiles(value.files);if(JSON.stringify({manifest:value.manifest,mcp:value.mcp}).length>256000)throw new Error('Plugin declarations exceed 256 KB.');
 if(!validator.getValidator(manifestSchema)(value.manifest).valid)throw new Error('plugin.json does not match the pinned Agent Plugins 1.0.0 schema.');
 const normalized=JSON.parse(JSON.stringify(value)),manifest=normalized.manifest;
 // The portable schema makes release copy optional. Keep local packages usable
 // with a content-derived local revision and a neutral identity fallback.
 if(manifest.version===undefined)manifest.version='0.0.0-local.'+createHash('sha256').update(JSON.stringify(canonical(normalized))).digest('hex').slice(0,16);
 if(manifest.description===undefined)manifest.description=manifest.name;
 if(!name.test(manifest.name)||manifest.name.includes('..')||manifest.name.includes('--')||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version??'')||typeof manifest.description!=='string'||!manifest.description.trim()||manifest.description.length>4000)throw new Error('Agentopia requires a stable plugin name, semantic version, and description.');
 for(const key of ['homepage','repository'])if(manifest[key]){const u=mcpAddress(manifest[key]);if(u.search)throw new Error('Plugin metadata URLs cannot contain query parameters.');}
 const extensions=manifest.extensions??{};
 if(Object.keys(extensions).some(key=>!['com.agentopia','com.openai'].includes(key)))throw new Error('This host supports packaged skills, remote MCP packages and descriptive OpenAI presentation metadata. Other extensions are not supported.');
 if(extensions['com.openai']!==undefined)validateOpenAIPresentation(extensions['com.openai']);
 if(extensions['com.agentopia']){const extension=extensions['com.agentopia'];if(!bundled||!(Object.keys(extension).length===1&&(['serper','tavily'].includes(extension.adapter)||extension.managedMcp===chromePluginName||extension.imageGeneration==='v1'&&manifest.name===imageGenerationPluginName)))throw new Error('Only pinned bundled plugins may select a managed runtime or search adapter.');}
 if(value.mcp!==undefined){
  const portable=structuredClone(value.mcp);
  if(record(portable)&&record(portable.mcpServers))for(const server of Object.values(portable.mcpServers))if(record(server)){mcpOAuthDeclaration(server.extensions);delete server.extensions;}
  if(!validator.getValidator(mcpSchema)(portable).valid)throw new Error('mcp.json does not match the pinned Agent Plugins 1.0.0 schema.');
  const servers=Object.entries(value.mcp.mcpServers);if(servers.length<1||servers.length>10)throw new Error('Declare between one and ten remote MCP servers.');
  for(const [key,s] of servers as [string,any][]){
   if(!name.test(key)||key.length>64||!['streamable-http','sse'].includes(s.type))throw new Error('Only named remote Streamable HTTP or SSE servers are supported. Local commands are not installed.');
   if(Object.keys(s).some(key=>!['type','url','extensions'].includes(key)))throw new Error('Keep credentials and headers out of plugin packages. Set a protected Bearer credential or use browser sign-in in the connection pane.');
   const u=mcpAddress(s.url);if(u.search||/\$\{|%24%7b/i.test(s.url))throw new Error('Plugin server URLs must be literal addresses without query parameters or credentials.');
  }
 }else if(!bundled&&!files)throw new Error('An imported plugin requires mcp.json or packaged skills.');
 if(bundled&&!extensions['com.agentopia']&&!value.mcp)throw new Error('A plugin must declare a supported connection.');
 if(JSON.stringify(normalized).length>pluginSkillLimits.packageBytes)throw new Error('The normalized plugin exceeds 4 MB.');return normalized;
}
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):record(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const pluginDigest=(pkg:PluginPackage)=>createHash('sha256').update(JSON.stringify(canonical(pkg))).digest('hex');
export function validateLegacyPlugin(pkg:PluginPackage){if(!validator.getValidator(manifestSchema)(pkg.manifest).valid||Object.keys(pkg).length!==1||!/^mcp-[0-9a-f-]{36}$/.test(pkg.manifest.name))throw new Error('Invalid protected connection wrapper.');}
export const searchPlugins=['serper','tavily'].map(adapter=>validatePluginPackage({manifest:{$schema:pluginSchemaUrl,name:adapter+'-search',version:'1.0.0',description:adapter==='serper'?'Search the web using your administrator’s Serper connection.':'Search the web using your administrator’s Tavily connection. A free monthly tier is available.',author:{name:'Agentopia'},extensions:{'com.agentopia':{adapter}}}},true));
export const chromePlugin=validatePluginPackage({manifest:{$schema:pluginSchemaUrl,name:chromePluginName,version:'1.11.0',description:'Google Chrome DevTools: connect your Chrome session, inspect pages, capture screenshots, and use browser, network and performance tools.',author:{name:'Chrome DevTools'},license:'Apache-2.0',extensions:{'com.agentopia':{managedMcp:chromePluginName}}}},true);
export const imagePlugin=validatePluginPackage({manifest:{$schema:pluginSchemaUrl,name:imageGenerationPluginName,version:'1.0.0',description:'Create and edit images through an explicitly configured image connection. Ordinary chats keep their selected AI connection. Every image request shows its provider, model and reference sharing for review.',author:{name:'Agentopia'},extensions:{'com.agentopia':{imageGeneration:'v1'}}}},true);
export const bundledPlugins=[...searchPlugins,chromePlugin,imagePlugin];
export const examplePluginPackage:PluginPackage={manifest:{$schema:pluginSchemaUrl,name:'microsoft-learn',version:'1.0.0',description:'Search Microsoft Learn documentation.'},mcp:{$schema:mcpSchemaUrl,mcpServers:{docs:{type:'streamable-http',url:'https://learn.microsoft.com/api/mcp'}}}};

// Compile a bounded, local-only JSON Schema before advertising or invoking a tool.
// Remote references must never cause schema-driven network requests.
export function validateToolDescriptor(tool:any){
 if(!record(tool)||typeof tool.name!=='string'||!tool.name.length||tool.name.length>128||!/^[A-Za-z0-9_.-]+$/.test(tool.name)||!record(tool.inputSchema)||tool.inputSchema.type!=='object'||tool.description!==undefined&&typeof tool.description!=='string')throw new Error('The server returned an invalid tool descriptor.');
 for(const schema of [tool.inputSchema,tool.outputSchema].filter(Boolean)){
  if(!record(schema)||JSON.stringify(schema).length>100000)throw new Error('The tool schema exceeds the supported limit.');
  const visit=(v:any,d=0)=>{if(d>32)throw new Error('The tool schema is nested too deeply.');if(Array.isArray(v))v.forEach(x=>visit(x,d+1));else if(record(v))for(const [k,x] of Object.entries(v)){if(['__proto__','prototype','constructor','$dynamicRef','$recursiveRef'].includes(k))throw new Error('Unsupported tool schema property.');if(k==='$ref'&&(typeof x!=='string'||!x.startsWith('#')))throw new Error('Only local schema references are supported.');visit(x,d+1);}};visit(schema);
  validator.getValidator(schema);
 }
 if(tool.annotations!==undefined){if(!record(tool.annotations))throw new Error('Invalid tool annotations.');for(const key of ['readOnlyHint','destructiveHint','openWorldHint','idempotentHint'])if(tool.annotations[key]!==undefined&&typeof tool.annotations[key]!=='boolean')throw new Error('Invalid tool annotations.');}
 return tool;
}
