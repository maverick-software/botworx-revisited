const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createServer}=require('node:http'),{createHash}=require('node:crypto');
const build=process.env.AGENTOPIA_OAUTH_TEST_BUILD||path.resolve(__dirname,'../build');
const {McpOAuth}=require(path.join(build,'mcp-oauth.js')),{oauthNetwork,publicOAuthAddress}=require(path.join(build,'mcp-oauth-network.js')),{withMcp}=require(path.join(build,'mcp-client.js'));
const scope={owner:'owner-a',agent:'agent-a',connection:'connection-a'};
async function fixture(t,options={}){
 const records=new Map(),requests=[],browser=[];let owner=scope.owner,stamp='reviewed-plugin-a',base,challenge,registrations=0,exchanges=0,refreshes=0;
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,base);let body='';for await(const value of req)body+=value;
  const form=new URLSearchParams(body);requests.push({path:url.pathname,method:req.method,authorization:req.headers.authorization,body});
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
  if(url.pathname==='/mcp'){
   if(!req.headers.authorization){res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="${base}/custom-resource", scope="notes:read"`}).end();return;}
   assert.match(req.headers.authorization,/^Bearer access-/);
   if(req.method!=='POST'){res.writeHead(405).end();return;}
   const value=JSON.parse(body);if(value.id===undefined){res.writeHead(202).end();return;}
   const result=value.method==='initialize'?{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'OAuth fixture',version:'1'}}:value.method==='tools/list'?{tools:[{name:'read_note',inputSchema:{type:'object',properties:{}}}]}:{content:[{type:'text',text:'fixture result'}]};
   json({jsonrpc:'2.0',id:value.id,result});return;
  }
  if(url.pathname==='/custom-resource'){json({resource:base+'/mcp',authorization_servers:[base],scopes_supported:['notes:read']});return;}
  if(url.pathname==='/.well-known/oauth-authorization-server'){json({issuer:base,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',registration_endpoint:base+'/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:options.noPkce?['plain']:['S256'],token_endpoint_auth_methods_supported:['none'],authorization_response_iss_parameter_supported:true,client_id_metadata_document_supported:true});return;}
  if(url.pathname==='/register'){registrations++;const value=JSON.parse(body);assert.equal(value.token_endpoint_auth_method,'none');json({...value,client_id:'registered-fixture'});return;}
  if(url.pathname==='/token'){
   assert.equal(form.get('resource'),base+'/mcp');
   if(form.get('grant_type')==='refresh_token'){refreshes++;assert.equal(form.get('refresh_token'),options.rotate?'refresh-'+(refreshes-1):'refresh-fixture');if(options.refreshFailure){json({error:'invalid_grant'},400);return;}await new Promise(r=>setTimeout(r,20));}
   else{exchanges++;assert.equal(form.get('grant_type'),'authorization_code');assert.equal(form.get('code'),'fixture-code');assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),challenge.searchParams.get('code_challenge'));assert.equal(form.get('redirect_uri'),challenge.searchParams.get('redirect_uri'));assert.equal(form.get('client_id'),challenge.searchParams.get('client_id'));}
   if(options.exchangeFailure&&!refreshes){json({error:'invalid_grant'},400);return;}
   json({access_token:options.rotate?'access-'+refreshes+'-'+exchanges:'access-'+(refreshes?'refreshed':'initial'),token_type:'Bearer',refresh_token:options.rotate?'refresh-'+refreshes:'refresh-fixture',expires_in:options.expired&&!refreshes?1:3600,scope:refreshes&&options.omitRefreshScope?undefined:refreshes&&options.refreshScope!==undefined?options.refreshScope:'notes:read'});return;
  }
  if(url.pathname==='/redirect'){res.writeHead(302,{Location:base+'/unexpected'}).end();return;}
  if(url.pathname==='/oversized'){res.end('x'.repeat(1024*1024+1));return;}
  res.writeHead(404).end();
 }catch(error){res.writeHead(500).end('fixture assertion');server.lastError=error;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const store={get:key=>records.get(key),set:async(key,value)=>{if(value===undefined)records.delete(key);else records.set(key,value);}};
 const target=async()=>({address:base+'/mcp',stamp,auth:options.auth}),opened=new Promise(resolve=>options.onOpen=resolve);
 const open=async address=>{challenge=new URL(address);browser.push(address);assert.equal(challenge.origin,base);assert.equal(challenge.searchParams.get('resource'),base+'/mcp');assert.equal(challenge.searchParams.get('code_challenge_method'),'S256');assert.equal(challenge.searchParams.get('scope'),Object.hasOwn(options,'expectedScope')?options.expectedScope:'notes:read');options.onOpen(challenge);if(options.hold)return;await callback(options.issuer??base);};
 const make=()=>new McpOAuth(store,target,async()=>owner,open),oauth=make();
 async function callback(issuer=base,override={}){const url=new URL(challenge.searchParams.get('redirect_uri'));for(const [key,value]of Object.entries({state:challenge.searchParams.get('state'),code:'fixture-code',iss:issuer,...override}))if(value!==undefined)url.searchParams.set(key,value);return fetch(url);}
 t.after(async()=>{oauth.cancel();server.closeAllConnections();await new Promise(r=>server.close(r));if(server.lastError)throw server.lastError;});
 return {oauth,make,open,store,records,requests,browser,base,opened,callback,get counts(){return {registrations,exchanges,refreshes};},setOwner:value=>owner=value,setStamp:value=>stamp=value};
}

module.exports={fixture,scope};
