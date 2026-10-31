import type {Message,Provider} from '../src/contracts';

export function failureProvider(message:Message,previous?:Message):Provider|undefined{
 if(message.role!=='assistant')return undefined;
 // SQL stores submitted options on the prompt. Never label an old failure
 // using the agent's current default or a later composer selection.
 return message.metadata.options?.provider??(previous?.role==='user'?previous.metadata.options?.provider:undefined);
}

/** Classify fixed gateway messages and the observed native subscription refusal. */
type ConnectionNotice={title:string;message:string;billing?:boolean};
export const sylvanaBillingURL='https://sylvana-legal-web-app.vercel.app/?view=billing';
export const sylvanaResetURL='https://sylvana-legal-web-app.vercel.app/?view=usage#usage-resets';
export function connectionFailure(error:string|undefined,provider:Provider|undefined):ConnectionNotice|null{
 if(!error)return null;
 const nativeError=error.replace(/^stream disconnected before completion: /,''),status=nativeError.match(/^(?:unexpected status |exceeded retry limit, last status: )(\d{3})\b/)?.[1];
 const sylvanaAllowance='Your Sylvana allowance is exhausted. Manage usage in the firm dashboard.';
 if((provider==='sylvana'&&(status==='402'||nativeError===sylvanaAllowance))||(!provider&&status==='402'&&nativeError.includes(sylvanaAllowance)))return {title:'Subscription or balance needed',message:'You need an active subscription or more usage balance to continue.',billing:true};
 if(provider==='sylvana'){
  if(status==='401')return {title:'Sign in to Sylvana again',message:'Your session has ended. Sign in again, then resend your message.'};
  if(status==='403')return {title:'Sylvana access unavailable',message:'Ask your firm administrator to check your account access, then try again.'};
  if(status==='429')return {title:'Sylvana is busy',message:'Wait a moment, then try sending your message again.'};
  if(status==='413')return {title:'Your message is too large',message:'Shorten your message or use smaller attachments, then try again.'};
  if(status==='409')return {title:'Your message was already submitted',message:'Check this chat for its reply before sending the message again.'};
  if(status==='408'||status==='504')return {title:'The response took too long',message:'Try again with a shorter message. If this continues, contact Sylvana support.'};
  if(status==='400'||status==='422')return {title:'Your message could not be processed',message:'Try a new chat or shorten your message. If this continues, contact Sylvana support.'};
  if(status&&Number(status)>=500)return {title:'Sylvana could not complete your message',message:'Please try again shortly. If this continues, contact Sylvana support.'};
  if(/stream disconnected|connection failed/i.test(error))return {title:'The connection was interrupted',message:'Check your internet connection, then try sending your message again.'};
  return {title:'Your message could not be completed',message:'Please try again. If this continues, contact Sylvana support.'};
 }
 if(!provider)return null;
 const label=provider==='openrouter'?'OpenRouter':'ChatGPT';
 const subscriptionLimit='The ChatGPT user has reached their Subscription Sharing usage limit. Ask the user to try again after their usage limit resets or use an API key instead.';
 if(provider==='openai-oauth'&&(error===subscriptionLimit||error==='stream disconnected before completion: '+subscriptionLimit))return {title:'ChatGPT usage limit reached',message:'Your ChatGPT account has reached its usage limit. Wait until the allowance resets before sending another message. You can review usage from the account menu.'};
 if(status==='429'||error.includes('The provider reached a usage limit.'))return {title:label+' usage limit reached',message:'Wait before sending another message. Your selected connection stays the same.'};
 if(status==='401'||error.includes('The provider credential expired or is invalid.'))return {title:'Reconnect '+label,message:'Open AI connections to reconnect your account, then send your message again.'};
 if(status==='403'||error.includes('This account is not authorized for the selected model or capability.'))return {title:label+' model access unavailable',message:'Review this connection or choose a model available to your account before sending again.'};
 if(provider==='openrouter'&&(status==='402'||error.includes('OpenRouter needs more credits.')))return {title:'OpenRouter credits needed',message:'Review your OpenRouter balance before sending another message.'};
 if(error.includes('The provider connection failed. Check AI connections and retry.'))return {title:label+' connection unavailable',message:'Check AI connections and try again when the connection is available.'};
 return null;
}
