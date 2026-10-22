import React from 'react';
import type {ProviderStatus} from '../src/contracts';

export function ChatGPTConnectionStatus({connection}:{connection:ProviderStatus['chatgpt']}){
 if(!connection)return <p>Connect your ChatGPT account for your own agents. This connection belongs to your Agentopia user.</p>;
 const issue=connection.connectionIssue;
 return <><p>{issue?'Saved account: '+connection.email+'.':'Connected as '+connection.email+'. Plan access '+(connection.authorized?'authorized':'requires authorization')+'.'}</p>{issue&&<div role="status" className="connection-recovery"><strong>{issue.kind==='reauthorize'?'Reconnect ChatGPT':issue.kind==='configuration'?'Connection configuration needs attention':'ChatGPT connection needs retry'}</strong><p>{issue.message}</p>{issue.code&&<small>Connection code: {issue.code}</small>}</div>}</>;
}
