import {expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
export async function verifySettingsUI(page,service,agentId,artifacts){
 const tag=randomUUID().replaceAll('-',''),providerName='desktop_ui_'+tag,promptKey='desktop_ui_'+tag;
 const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
 const nav=()=>page.getByRole('navigation',{name:'Settings sections'});
 const section=async name=>{await nav().getByRole('button',{name,exact:true}).click();};
 const saved=()=>expect(page.getByRole('status').filter({hasText:'Settings saved.'})).toBeVisible();
 await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:/^Settings/}).click();
 const user=(await page.evaluate(()=>window.agentopia.call('auth.state'))).identity;
 let providerId,promptId,connectionId;
 try{
  for(const name of ['Agent settings','Tools & credentials','System API keys','Integrations','Stripe billing','System prompts'])await expect(nav().getByRole('button',{name,exact:true})).toBeAttached();
  await section('Account');await page.getByLabel('First name',{exact:true}).fill('Desktop settings proof');await page.getByRole('button',{name:'Save profile',exact:true}).click();await saved();
  await section('System API keys');for(const name of ['OpenAI','Anthropic','Mistral AI']){await expect(page.getByLabel(name+' API key',{exact:true})).toHaveAttribute('type','password');assert.equal(await page.getByLabel(name+' API key',{exact:true}).inputValue(),'');}
  await section('Stripe billing');await expect(page.getByRole('button',{name:'Test connection',exact:true})).toBeVisible();await expect(page.getByLabel('Stripe secret key',{exact:true})).toHaveAttribute('type','password');
  await section('Integrations');await page.getByRole('button',{name:'Add integration',exact:true}).click();
  await page.getByLabel('Provider identifier',{exact:true}).fill(providerName);await page.getByLabel('Display name',{exact:true}).fill('Desktop UI test tool');
  await page.getByLabel('Authorization endpoint',{exact:true}).fill('https://example.invalid/authorize');await page.getByLabel('Token endpoint',{exact:true}).fill('https://example.invalid/token');
  await page.getByLabel('Supported scopes (JSON array)',{exact:true}).fill('["read"]');await page.getByRole('button',{name:'Save integration',exact:true}).click();await saved();
  providerId=check(await service.from('service_providers').select('id').eq('name',providerName).single()).id;
  await section('Tools & credentials');await page.getByText('Saved integration credentials',{exact:true}).click();await page.getByLabel('Integration provider',{exact:true}).selectOption(providerId);await page.getByLabel('Connection name',{exact:true}).fill('Desktop UI tool credential');await page.getByLabel('API key',{exact:true}).fill('disposable-ui-key-'+tag);
  await page.getByRole('button',{name:'Save credential',exact:true}).click();await expect(page.getByText('Credential stored. Provider access has not been tested.',{exact:true})).toBeVisible();
  assert.equal(await page.getByLabel('API key',{exact:true}).inputValue(),'');connectionId=check(await service.from('user_integration_credentials').select('id').eq('user_id',user.id).eq('oauth_provider_id',providerId).single()).id;
  await section('System prompts');await page.getByRole('button',{name:'Add prompt',exact:true}).click();await page.getByLabel('Prompt key',{exact:true}).fill(promptKey);await page.getByLabel('Prompt name',{exact:true}).fill('Desktop UI prompt');await page.getByLabel('Prompt content',{exact:true}).fill('Use the configured tools carefully.');await page.getByRole('button',{name:'Save prompt',exact:true}).click();await saved();
  promptId=check(await service.from('system_prompts').select('id').eq('key',promptKey).single()).id;
  await page.getByLabel('Search prompts',{exact:true}).fill(promptKey);const promptRow=page.locator('.settings-list-row').filter({hasText:'Desktop UI prompt'});await promptRow.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Prompt content',{exact:true}).fill('Updated shared prompt.');await page.getByRole('button',{name:'Save prompt',exact:true}).click();await saved();
  assert.equal(check(await service.from('system_prompts').select('content').eq('id',promptId).single()).content,'Updated shared prompt.');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Desktop UI prompt',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Prompt removed.'})).toBeVisible();promptId=undefined;
  await section('Agent settings');await page.getByRole('button',{name:'Configure',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit agent',exact:true})).toBeVisible();
  const agentNav=page.getByRole('navigation',{name:'Agent settings sections'});assert.equal(await agentNav.getByRole('button').count(),14);
  await agentNav.getByRole('button',{name:'Capabilities',exact:true}).click();await page.getByLabel('Web search',{exact:true}).check();await page.getByLabel('Read documents',{exact:true}).check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved();
  await page.screenshot({path:path.join(artifacts,'agent-capabilities.png')});
  await agentNav.getByRole('button',{name:'Memory',exact:true}).click();await page.getByLabel('Conversation context',{exact:true}).selectOption('10');await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved();
  await agentNav.getByRole('button',{name:'Identity',exact:true}).click();await page.getByLabel('Personality and tone',{exact:true}).fill('Use a thoughtful, friendly tone.');await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved();
  await agentNav.getByRole('button',{name:'Sources',exact:true}).click();await page.getByLabel('Desktop UI tool credential · Desktop UI test tool',{exact:true}).check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved();
  await agentNav.getByRole('button',{name:'Channels',exact:true}).click();await page.getByLabel('sms channel',{exact:true}).check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved();
  for(const name of ['Documents','Team','Contacts','Workflows','Automations']){await agentNav.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('region',{name:'Agent '+name,exact:true})).toBeVisible();}
  await agentNav.getByRole('button',{name:'MCP',exact:true}).click();await page.getByLabel('Connection name',{exact:true}).fill('Desktop UI MCP');await page.getByLabel('Server URL',{exact:true}).fill('https://mcp.example.invalid/private-'+tag+'?token=private-query');await page.getByRole('button',{name:'Save MCP server',exact:true}).click();await saved();assert.equal(await page.getByLabel('Server URL',{exact:true}).inputValue(),'');
  await agentNav.getByRole('button',{name:'Schedule',exact:true}).click();await page.getByLabel('Task name',{exact:true}).fill('Desktop UI scheduled task');await page.getByLabel('Task instructions',{exact:true}).fill('Review the project.');await page.getByRole('button',{name:'Save paused schedule',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Schedule saved paused.'})).toBeVisible();
  assert.equal(check(await service.from('agent_tasks').select('status').eq('agent_id',agentId).single()).status,'paused');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await saved();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Edit '+check(await service.from('agents').select('name').eq('id',agentId).single()).name,exact:true}).click();await agentNav.getByRole('button',{name:'Capabilities',exact:true}).click();await expect(page.getByLabel('Web search',{exact:true})).toBeChecked();await expect(page.getByLabel('Read documents',{exact:true})).toBeChecked();
  const snapshot=await page.evaluate(id=>window.agentopia.call('agentSettings.get',{agentId:id}),agentId);assert.equal(snapshot.agent.settings.context_history_size,10);assert.equal(snapshot.agent.personality,'Use a thoughtful, friendly tone.');assert(snapshot.connectionIds.includes(connectionId));assert(snapshot.connectionIds.every(id=>snapshot.connections.some(row=>row.id===id)));assert.equal(snapshot.agent.sms_enabled,true);assert(!JSON.stringify(snapshot).includes('private-query'));assert(!JSON.stringify(snapshot).includes('disposable-ui-key-'));
  await agentNav.getByRole('button',{name:'MCP',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove',exact:true}).click();await saved();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:/^Settings/}).click();await section('Tools & credentials');await page.getByText('Saved integration credentials',{exact:true}).click();page.once('dialog',d=>d.accept());await page.locator('.settings-list-row').filter({hasText:'Desktop UI tool credential'}).getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Connection revoked.'})).toBeVisible();
  check(await service.from('user_integration_credentials').delete().eq('id',connectionId));connectionId=undefined;
  await section('Integrations');await page.getByLabel('Search integrations',{exact:true}).fill(providerName);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Desktop UI test tool',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Integration removed.'})).toBeVisible();providerId=undefined;
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  console.log('PASS: Installed settings panes restore editable profiles, system key/Stripe controls, integration and prompt CRUD, personal credentials, all 14 agent sections, capability persistence, context limits, source/channel permissions, protected MCP setup, and paused schedules.');
 }finally{
  if(promptId)await service.from('system_prompts').delete().eq('id',promptId);
  if(connectionId){await service.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'connection',p_id:connectionId,p_secret:null,p_value:{providerId:null,name:''}});await service.from('user_integration_credentials').delete().eq('id',connectionId);}
  if(providerId)await service.from('service_providers').delete().eq('id',providerId);
 }
}
