const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {startupLocation}=require('../build/startup-location.js'),{childChatPath}=require('../build/native-navigation.js');
const conversationId=randomUUID(),other=randomUUID(),child={requestId:randomUUID(),threadId:randomUUID()},saved={view:'chat',conversationId,agentId:randomUUID(),projectId:randomUUID(),child};
test('the explicit Scheduled route wins over the remembered conversation',()=>assert.deepEqual(startupLocation('/scheduled',saved),{view:'scheduled'}));
test('explicit parent routes open the main chat without inheriting any saved child or view',()=>{
 for(const remembered of [saved,{...saved,view:'plugins'},null])for(const target of [conversationId,other])assert.deepEqual(startupLocation('/conversations/'+target,remembered),{view:'chat',conversationId:target});
 assert.deepEqual(startupLocation('/conversations/'+conversationId+'/',saved),{view:'chat',conversationId});assert.deepEqual(saved.child,child);
 assert.deepEqual(startupLocation('/conversations/'+other+'/subagents/missing',saved),{view:'chat',conversationId:other});
});
test('explicit child routes select only the requested parent and child',()=>{const requested={requestId:randomUUID(),threadId:randomUUID()};assert.deepEqual(startupLocation(childChatPath(other,requested),saved),{view:'chat',conversationId:other,child:requested});});
test('library and new-chat routes take precedence over the last saved conversation',()=>{
 for(const view of ['agents','plugins','tools','skills'])assert.deepEqual(startupLocation('/'+view,saved),{view});
 assert.deepEqual(startupLocation('/chats',saved),{view:'chat',agentId:saved.agentId});assert.deepEqual(startupLocation('/chats',{view:'chat',agentId:saved.agentId,projectId:saved.projectId}),{view:'chat',agentId:saved.agentId,projectId:saved.projectId});assert.deepEqual(startupLocation('/chats',null),{view:'chat'});
});
test('ordinary startup preserves the saved main, child, or library location without changing it',()=>{for(const location of [null,{view:'agents'},{view:'tools'},{view:'skills'},saved])assert.deepEqual(startupLocation('/login',location),location);});
