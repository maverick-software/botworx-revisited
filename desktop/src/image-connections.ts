import {createHash} from 'node:crypto';
import type {Secrets} from './secrets';
import type {SylvanaAccount} from './sylvana-account';
import {imageConnection,type ImageConnection,type ImageProvider} from './image-generation-contracts';
import {imageModels} from './image-models';

export type ImageConnectionStatus={connection:ImageConnection;credentialAvailable:boolean;openRouterAvailable:boolean;openAIKeyAvailable:boolean;sylvanaAvailable?:boolean;legalMode?:boolean;openAIAllowed?:boolean;openRouterAllowed?:boolean};
/** Image credentials never substitute for a chat credential or subscription grant. */
export class ImageConnections{
 constructor(private secrets:Secrets,private account?:SylvanaAccount){}
 private key(owner:string){return 'image-generation:'+owner;}
 connection(owner:string):ImageConnection{const legal=this.secrets.get('sylvana-legal:'+owner)&&!this.account?.allows(owner,'openai-api'),managed=this.account?.status(owner);const value=imageConnection(legal&&this.account?this.secrets.get('image-generation-sylvana:'+owner)??{enabled:false,provider:'sylvana',model:'standard'}:this.secrets.get(this.key(owner))??{enabled:false,provider:'openrouter',model:''});const connection=this.account?{...value,model:value.model==='advanced'?'advanced':'standard'}:value;return legal&&(!managed?.linked||managed.simulated)?{...connection,enabled:false}:connection;}
 async resolve(owner:string,value=this.connection(owner)):Promise<ImageConnection>{
  if(!this.account)return value;
  await this.account.verifySession(owner,true);
  if(value.provider==='sylvana'){await this.account.providerURL(owner);return value;}
  const model=await this.account.directModel(owner,value.provider,value.model,'images');
  if(!(await imageModels(value.provider,AbortSignal.timeout(20000))).some(m=>m.id===model))throw Error('This image service level is unavailable to the configured connection.');
  return {...value,model};
 }
 credential(owner:string,provider:ImageProvider){if(provider==='sylvana'||(this.account?!this.account.allows(owner,provider):this.secrets.get('sylvana-legal:'+owner)))return;return provider==='openrouter'?this.secrets.get<{key:string}>('openrouter')?.key:this.secrets.get<string>('image-openai-key:'+owner);}
 async credentialFor(owner:string,provider:ImageProvider){if(this.account?.status(owner).linked)await this.account.verifySession(owner,true);if(provider==='sylvana'){if(!this.account)throw Error('Connect Sylvana first.');return this.account.access(owner);}const token=this.credential(owner,provider);if(!token)throw Error('The image connection is unavailable under your current policy.');return token;}
 transport(owner:string){if(!this.account)throw Error('Connect Sylvana first.');return this.account.transport(owner);}
 status(owner:string):ImageConnectionStatus{const connection=this.connection(owner),openRouterAvailable=!!this.credential(owner,'openrouter'),openAIKeyAvailable=!!this.credential(owner,'openai-api'),managed=this.account?.status(owner),sylvanaAvailable=!!managed?.linked&&!managed.simulated;return {connection,openRouterAvailable,openAIKeyAvailable,sylvanaAvailable,legalMode:!!this.secrets.get('sylvana-legal:'+owner),openAIAllowed:this.account?.allows(owner,'openai-api')??!this.secrets.get('sylvana-legal:'+owner),openRouterAllowed:this.account?.allows(owner,'openrouter')??!this.secrets.get('sylvana-legal:'+owner),credentialAvailable:connection.provider==='sylvana'?sylvanaAvailable:connection.provider==='openrouter'?openRouterAvailable:openAIKeyAvailable};}
 configured(owner:string){const status=this.status(owner);return status.connection.enabled&&status.credentialAvailable&&!!status.connection.model;}
 fingerprint(owner:string){const value=this.connection(owner);return createHash('sha256').update(JSON.stringify([value,this.credential(owner,value.provider)??null])).digest('hex');}
 async save(owner:string,value:unknown){const connection=imageConnection(value);if(this.account&&!['standard','advanced'].includes(connection.model))throw Error('Choose Standard or Advanced.');if(this.account?.status(owner).linked)await this.account.verifySession(owner,true);if(connection.enabled&&connection.provider!=='sylvana'){if(this.account)this.account.assertConnection(owner,connection.provider);else if(this.secrets.get('sylvana-legal:'+owner))throw Error('Direct image generation is disabled in Sylvana legal compliance mode.');}if(connection.enabled){if(this.account)await this.resolve(owner,connection);if(connection.provider==='sylvana'){if(!this.status(owner).sylvanaAvailable)throw Error('Connect the Sylvana provider first.');}else if(!this.credential(owner,connection.provider))throw Error('Connect the chosen image provider before enabling image generation.');}if(connection.provider==='sylvana')await this.secrets.set('image-generation-sylvana:'+owner,connection);if(!this.secrets.get('sylvana-legal:'+owner)||this.account?.allows(owner,connection.provider))await this.secrets.set(this.key(owner),connection);return this.status(owner);}
 async saveOpenAIKey(owner:string,key:unknown){if(typeof key!=='string'||!key.trim()||key.length>16384||/[\r\n]/.test(key))throw new Error('Enter a valid OpenAI API key.');await this.secrets.set('image-openai-key:'+owner,key.trim());return this.status(owner);}
 async removeOpenAIKey(owner:string){const connection=this.connection(owner);if(connection.provider==='openai-api')await this.secrets.set(this.key(owner),{...connection,enabled:false});await this.secrets.set('image-openai-key:'+owner,undefined);return this.status(owner);}
}
