const assert=require('node:assert/strict'),crypto=require('node:crypto');
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item),same=(a,b)=>stable(a)===stable(b),digest=value=>crypto.createHash('sha256').update(stable(value)).digest('hex'),object=value=>value&&typeof value==='object'&&!Array.isArray(value),uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
function rotation(before,after){
 assert(object(before)&&object(after));assert(same({...before,tokens:null,expiresAt:null},{...after,tokens:null,expiresAt:null}),'OAuth grant, owner target, issuer, client or discovery changed');
 assert(before.target.address==='https://connect.composio.dev/mcp'&&/^[a-f0-9]{64}$/.test(before.grantId));
 assert(object(before.tokens)&&object(after.tokens));const mutable=new Set(['access_token','refresh_token','expires_in']);assert(same(Object.fromEntries(Object.entries(before.tokens).filter(([key])=>!mutable.has(key))),Object.fromEntries(Object.entries(after.tokens).filter(([key])=>!mutable.has(key)))),'OAuth token authority changed');
 assert(typeof after.tokens.access_token==='string'&&after.tokens.access_token&&typeof after.tokens.refresh_token==='string'&&after.tokens.refresh_token);assert(Number.isFinite(after.expiresAt)&&after.expiresAt>=(before.expiresAt??0)&&after.expiresAt>Date.now());return true;
}
function metadata(value,record,key){
 assert(object(value)&&value.version===1&&/^[a-f0-9]{64}$/.test(value.authority)&&/^[a-f0-9]{64}$/.test(value.catalogRevision));assert(Object.keys(value).every(key=>['version','authority','catalogRevision','services','selections','complete'].includes(key)));assert(typeof value.complete==='boolean'&&object(value.services)&&object(value.selections));assert(record?.target?.address==='https://connect.composio.dev/mcp');
 const scope=record.tokens?.scope,grant=crypto.createHash('sha256').update(JSON.stringify([key,record.target.stamp,record.grantId??['legacy',record.redirect,record.client?.client_id??''],scope===undefined?null:[...new Set(scope.split(/\s+/).filter(Boolean))].sort()])).digest('hex');assert.equal(value.authority,digest([grant,record.target.stamp]));
 assert(Object.keys(value.services).length<=2000&&Object.keys(value.selections).length<=2000);for(const[slug,row]of Object.entries(value.services)){assert(/^_?[a-z0-9][a-z0-9_]{0,99}$/.test(slug)&&object(row)&&row.slug===slug);assert(Object.keys(row).every(key=>['slug','name','toolCount','triggerCount','assignable','connected','hasActiveAccounts','requiresAccountSelection','status','accounts','selectedAccountId','checkedAt','error'].includes(key)));assert(Array.isArray(row.accounts)&&row.accounts.length<=1000);for(const account of row.accounts)assert(object(account)&&Object.keys(account).every(key=>['id','alias','status'].includes(key))&&typeof account.id==='string'&&typeof account.status==='string');}for(const[slug,id]of Object.entries(value.selections))assert(/^_?[a-z0-9][a-z0-9_]{0,99}$/.test(slug)&&typeof id==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(id));return true;
}
function approvedChange(key,before,after,left,right,owner){
 if(!uuid(owner))return undefined;
 if(key==='mcp-oauth-account:'+owner+':composio'){rotation(before,after);return 'verifiedComposioRotation';}
 if(key==='composio-services:'+owner){assert(after!==undefined,'Composio metadata was removed');metadata(after,right['mcp-oauth-account:'+owner+':composio'],'mcp-oauth-account:'+owner+':composio');return 'verifiedComposioMetadata';}
 if(key==='desktop-location:'+owner&&before?.view==='tools'&&same({...before,view:'plugins'},after))return 'verifiedToolsRedirect';
}
module.exports={approvedChange,rotation,metadata};
