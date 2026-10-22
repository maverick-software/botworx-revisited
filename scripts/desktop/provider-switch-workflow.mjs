import {openModelCatalog,thinkingSlider} from './model-controls.mjs';
import {verifyDefaultConnectionUI} from './default-connection-workflow.mjs';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import path from 'node:path';

// Only called by the isolated verification profile. Authorization, catalogs, and
// inference are controlled fixtures; the Electron UI, broker, and database are real.
export async function verifyProviderSwitchUI(app,page,artifacts,withBothProviders){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const publicJwk={...publicKey.export({format:'jwk'}),kid:'provider-ui-fixture',alg:'RS256',use:'sig'};
 const email='provider-ui@example.com';let conversation;
 await app.evaluate(async({shell},fixture)=>{
  const originalFetch=globalThis.fetch,originalOpen=shell.openExternal;
  globalThis.__providerUIRestore=()=>{globalThis.fetch=originalFetch;shell.openExternal=originalOpen;};
  let authorization,tokens;const jwt=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const signing=await crypto.subtle.importKey('jwk',fixture.privateJwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  shell.openExternal=async value=>{
   if(!String(value).startsWith('https://auth.openai.com/api/accounts/authorize'))return originalOpen(value);
   authorization=new URL(value);const now=Math.floor(Date.now()/1000),header=jwt({alg:'RS256',kid:'provider-ui-fixture'}),payload=jwt({iss:'https://auth.openai.com',aud:'oaiapp_provider_ui',sub:'fixture-ui-subject',iat:now,exp:now+3600,nonce:authorization.searchParams.get('nonce'),email:fixture.email});
   const unsigned=header+'.'+payload,signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signing,new TextEncoder().encode(unsigned))).toString('base64url');
   tokens={id_token:unsigned+'.'+signature,access_token:'provider-ui-access',refresh_token:'provider-ui-refresh',scope:'openid email offline_access resource.invoke chatgpt.tokens.use.direct',expires_in:3600};
   const callback=new URL(authorization.searchParams.get('redirect_uri'));callback.searchParams.set('state',authorization.searchParams.get('state'));callback.searchParams.set('code','provider-ui-code');callback.searchParams.set('client_id','oaiapp_provider_ui');
   const response=await originalFetch(callback);if(!response.ok)throw new Error('The controlled OAuth callback failed.');
  };
  globalThis.fetch=async(input,options)=>{
   const url=String(input);
   if(url==='https://auth.openai.com/.well-known/jwks.json')return new Response(JSON.stringify({keys:[fixture.publicJwk]}));
   if(url==='https://auth.openai.com/api/accounts/oauth/token')return new Response(JSON.stringify(tokens));
   if(url==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[{slug:'fixture-gpt',display_name:'Personal verification model',visibility:'list',supported_reasoning_efforts:['low','medium','high']}]}));
   if(url==='https://api.openai.com/v1/responses'){
    globalThis.__providerUIChatGPTRequest=JSON.parse(options.body);
    return new Response('data: {"type":"response.output_text.delta","delta":"Personal verification answer"}\n\ndata: {"type":"response.completed"}\n\n');
   }
   return originalFetch(input,options);
  };
 },{publicJwk,privateJwk:privateKey.export({format:'jwk'}),email});
 const picker=()=>page.getByRole('button',{name:'Model and thinking',exact:true});
 const provider=id=>page.getByRole('group',{name:'Model provider'}).getByRole('button',{name:new RegExp('^'+id)});
 try{
  await page.getByRole('button',{name:'Start chat',exact:true}).click();await openModelCatalog(page);
  await openModelCatalog(page);await provider('ChatGPT').click();await expect(page.locator('.model-error')).toContainText('Connect ChatGPT');
  await page.getByRole('button',{name:'AI connections',exact:true}).click();await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue with ChatGPT',exact:true}).click();await expect(page.getByText(`Connected as ${email}. Plan access authorized.`,{exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Got it',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(picker()).toContainText('Personal verification model');await openModelCatalog(page);await expect(page.locator('.model-list').getByRole('button',{name:/Personal verification model/})).toBeVisible();
  await (await thinkingSlider(page)).press('End');await expect(page.locator('.model-trigger b')).toHaveText('High');
  await openModelCatalog(page);await provider('ChatGPT').click();await expect(picker()).toContainText('Personal verification model');await expect(page.locator('.model-trigger b')).toHaveText('High');await page.keyboard.press('Escape');
  await page.getByLabel('Message',{exact:true}).fill('Provider switch UI verification');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Personal verification answer',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
  const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));conversation=chats.find(c=>c.title==='Provider switch UI verification').conversation_id;
  await expect(page.locator('.composer-caption')).toContainText('Using your ChatGPT plan');
  await openModelCatalog(page);await provider('OpenRouter').click();await expect(picker()).toContainText('Verification model');await expect(page.locator('.model-trigger b')).toHaveText('High');await page.keyboard.press('Escape');
  await expect(page.locator('.composer-caption')).toContainText('shared OpenRouter connection');
  await page.getByLabel('Message',{exact:true}).fill('Continue through OpenRouter');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Saved verification answer',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
  const sent=await app.evaluate(()=>globalThis.__composerLastRequest);assert(sent.messages.some(m=>m.role==='assistant'&&m.content==='Personal verification answer'));assert.equal(sent.reasoning.effort,'high');
  await openModelCatalog(page);await provider('ChatGPT').click();await expect(picker()).toContainText('Personal verification model');await expect(page.locator('.model-trigger b')).toHaveText('High');
  await page.screenshot({path:path.join(artifacts,'provider-switch-thinking.png')});await page.keyboard.press('Escape');
  const originalBounds=await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0],bounds=window.getBounds();window.setBounds({...bounds,width:1000,height:700});return bounds;});
  await openModelCatalog(page);const bounds=await page.locator('.model-popover').boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert(bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,'The model picker escaped the compact desktop window');await page.screenshot({path:path.join(artifacts,'compact-model-thinking.png')});await page.keyboard.press('Escape');await app.evaluate(({BrowserWindow},bounds)=>BrowserWindow.getAllWindows()[0].setBounds(bounds),originalBounds);
  await page.getByLabel('Message',{exact:true}).fill('Continue after switching back');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);const previous=page.locator('.previous-messages-toggle[aria-expanded="false"]');if(await previous.count())await previous.click();await expect(page.getByText('Personal verification answer',{exact:true})).toHaveCount(2);
  const personal=await app.evaluate(()=>globalThis.__providerUIChatGPTRequest);assert(personal.input.some(m=>m.role==='assistant'&&m.content==='Saved verification answer'));assert.equal(personal.store,false);
  await page.keyboard.press('Control+Shift+o');await expect(page).toHaveURL(/\/chats$/);await expect(page.getByRole('heading',{name:'What can I help with?',exact:true})).toBeVisible();await expect(picker()).toContainText('Personal verification model');
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await expect(picker()).toContainText('Personal verification model');await expect(picker()).toContainText('High');
  await openModelCatalog(page);await provider('OpenRouter').click();await expect(picker()).toContainText('Verification model');await expect(page.locator('.model-trigger b')).toHaveText('High');await page.keyboard.press('Escape');
  if(process.env.AGENTOPIA_PROVIDER_DEFAULTS_CHECK==='1')await verifyDefaultConnectionUI(page,artifacts,conversation);
  if(withBothProviders)await withBothProviders(app,page,artifacts);
  await page.evaluate(()=>window.agentopia.call('providers.disconnectChatGPT'));await page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),conversation);conversation=undefined;
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:'Agents',exact:true}).click();
  console.log('PASS: Desktop UI connected a controlled OAuth account, switched providers in one conversation, kept High thinking and history, corrected the usage caption, and remembered both providers after reload. Provider traffic was simulated.');
 }finally{
  if(conversation)await page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),conversation).catch(()=>{});
  await page.evaluate(()=>window.agentopia.call('providers.disconnectChatGPT')).catch(()=>{});
  await app.evaluate(()=>globalThis.__providerUIRestore?.()).catch(()=>{});
 }
}
