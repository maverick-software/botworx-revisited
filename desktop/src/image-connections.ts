import {createHash} from 'node:crypto';
import type {Secrets} from './secrets';
import {imageConnection,type ImageConnection,type ImageProvider} from './image-generation-contracts';

export type ImageConnectionStatus={connection:ImageConnection;credentialAvailable:boolean;openRouterAvailable:boolean;openAIKeyAvailable:boolean};
/** Image credentials never substitute for a chat credential or subscription grant. */
export class ImageConnections{
 constructor(private secrets:Secrets){}
 private key(owner:string){return 'image-generation:'+owner;}
 connection(owner:string):ImageConnection{return imageConnection(this.secrets.get(this.key(owner))??{enabled:false,provider:'openrouter',model:''});}
 credential(owner:string,provider:ImageProvider){return provider==='openrouter'?this.secrets.get<{key:string}>('openrouter')?.key:this.secrets.get<string>('image-openai-key:'+owner);}
 status(owner:string):ImageConnectionStatus{const connection=this.connection(owner),openRouterAvailable=!!this.credential(owner,'openrouter'),openAIKeyAvailable=!!this.credential(owner,'openai-api');return {connection,openRouterAvailable,openAIKeyAvailable,credentialAvailable:connection.provider==='openrouter'?openRouterAvailable:openAIKeyAvailable};}
 configured(owner:string){const status=this.status(owner);return status.connection.enabled&&status.credentialAvailable&&!!status.connection.model;}
 fingerprint(owner:string){const value=this.connection(owner);return createHash('sha256').update(JSON.stringify([value,this.credential(owner,value.provider)??null])).digest('hex');}
 async save(owner:string,value:unknown){const connection=imageConnection(value);if(connection.enabled&&!this.credential(owner,connection.provider))throw new Error('Connect the chosen image provider before enabling image generation.');await this.secrets.set(this.key(owner),connection);return this.status(owner);}
 async saveOpenAIKey(owner:string,key:unknown){if(typeof key!=='string'||!key.trim()||key.length>16384||/[\r\n]/.test(key))throw new Error('Enter a valid OpenAI API key.');await this.secrets.set('image-openai-key:'+owner,key.trim());return this.status(owner);}
 async removeOpenAIKey(owner:string){const connection=this.connection(owner);if(connection.provider==='openai-api')await this.secrets.set(this.key(owner),{...connection,enabled:false});await this.secrets.set('image-openai-key:'+owner,undefined);return this.status(owner);}
}
