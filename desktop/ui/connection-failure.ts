import type {Message,Provider} from '../src/contracts';

export function failureProvider(message:Message,previous?:Message):Provider|undefined{
 if(message.role!=='assistant')return undefined;
 // SQL stores submitted options on the prompt. Never label an old failure
 // using the agent's current default or a later composer selection.
 return message.metadata.options?.provider??(previous?.role==='user'?previous.metadata.options?.provider:undefined);
}

/** Classify fixed gateway messages and the observed native subscription refusal. */
export function connectionFailure(error:string|undefined,provider:Provider|undefined){
 if(!error||!provider)return null;
 const label=provider==='openai-oauth'?'ChatGPT':'OpenRouter';
 const subscriptionLimit='The ChatGPT user has reached their Subscription Sharing usage limit. Ask the user to try again after their usage limit resets or use an API key instead.';
 if(provider==='openai-oauth'&&(error===subscriptionLimit||error==='stream disconnected before completion: '+subscriptionLimit))return {title:'ChatGPT usage limit reached',message:'Your ChatGPT account has reached its usage limit. Wait until the allowance resets before sending another message. You can review usage from the account menu.'};
 const status=error.match(/^(?:unexpected status |exceeded retry limit, last status: )(401|402|403|429)\b/)?.[1];
 if(status==='429'||error.includes('The provider reached a usage limit.'))return {title:label+' usage limit reached',message:'Wait before sending another message. Your selected connection stays the same.'};
 if(status==='401'||error.includes('The provider credential expired or is invalid.'))return {title:'Reconnect '+label,message:'Open AI connections to reconnect your account, then send your message again.'};
 if(status==='403'||error.includes('This account is not authorized for the selected model or capability.'))return {title:label+' model access unavailable',message:'Review this connection or choose a model available to your account before sending again.'};
 if(provider==='openrouter'&&(status==='402'||error.includes('OpenRouter needs more credits.')))return {title:'OpenRouter credits needed',message:'Review your OpenRouter balance before sending another message.'};
 if(error.includes('The provider connection failed. Check AI connections and retry.'))return {title:label+' connection unavailable',message:'Check AI connections and try again when the connection is available.'};
 return null;
}
