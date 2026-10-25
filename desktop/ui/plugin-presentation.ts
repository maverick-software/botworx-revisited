import type {PluginRecord} from '../src/plugin-contracts';

const names:Record<string,string>={
 'exa-web-search':'Web Search',
 'chrome-devtools':'Chrome DevTools',
 'composio-connect':'Composio',
 'image-generation':'Image Generation',
 'microsoft-learn':'Microsoft Learn',
 'microsoft-learn-desktop':'Microsoft Learn Desktop',
 'serper-search':'Serper Search',
 'tavily-search':'Tavily Search',
};
const words:Record<string,string>={api:'API',ai:'AI',mcp:'MCP',oauth:'OAuth',seo:'SEO',pdf:'PDF',sql:'SQL',url:'URL',http:'HTTP',https:'HTTPS',github:'GitHub',gitlab:'GitLab',openai:'OpenAI',openrouter:'OpenRouter',devtools:'DevTools',chatgpt:'ChatGPT',docx:'Word',pptx:'PowerPoint',xlsx:'Excel'};

/** Display labels only. Saved plugin names, grants and tool IDs remain unchanged. */
export function pluginName(name:string):string{
 const value=name.trim(),key=value.toLowerCase().replace(/[\s_]+/g,'-');
 if(Object.hasOwn(names,key))return names[key];
 if(/^mcp-[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(value))return 'Connected App';
 if(!value)return 'Plugin';
 // Preserve a publisher's readable name, including its capitalization and punctuation.
 if(!/^[\p{L}\p{N}]+(?:[-_.][\p{L}\p{N}]+)+$/u.test(value))return value;
 return value.split(/[-_.]+/).map(word=>Object.hasOwn(words,word.toLowerCase())?words[word.toLowerCase()]:word[0].toUpperCase()+word.slice(1)).join(' ');
}

export const pluginTitle=(plugin:Pick<PluginRecord,'name'|'description'|'kind'>)=>
 pluginName(plugin.description.startsWith('Existing protected MCP connection: ')?plugin.description.slice(35):plugin.kind==='images'?'image-generation':plugin.name);
