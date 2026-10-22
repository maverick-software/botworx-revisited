import type {DesktopLocation} from './contracts';
import {parseChildChatPath} from './native-navigation';

// A requested page wins over the last saved pane. Ordinary startup uses /login
// and can restore that saved pane, including a dedicated subagent chat.
export function startupLocation(path:string,remembered:DesktopLocation|null):DesktopLocation|null{
 const child=parseChildChatPath(path);
 if(child)return {view:'chat',conversationId:child.conversationId,child:child.child};
 const parent=/^\/conversations\/([a-f0-9-]{36})(?:\/.*)?$/i.exec(path);
 if(parent)return {view:'chat',conversationId:parent[1]};
 const agent=/^\/agents\/([a-f0-9-]{36})$/i.exec(path);
 if(agent)return {view:'agents',agentId:agent[1]};
 if(['/agents','/plugins','/skills','/tools','/scheduled'].includes(path))return {view:path.slice(1) as DesktopLocation['view']};
 if(path==='/chats')return {view:'chat',...(remembered?.agentId?{agentId:remembered.agentId}:{}),...(!remembered?.conversationId&&remembered?.projectId?{projectId:remembered.projectId}:{})};
 return remembered;
}
