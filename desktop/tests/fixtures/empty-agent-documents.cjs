// Partial-broker fixtures still use the real document service. Only its
// database catalog is empty; unexpected upload/read RPCs remain failures.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=build=>{
 const {AgentDocuments}=require(path.join(build,'agent-documents.js'));
 return new AgentDocuments({rpc:async(name)=>{assert.equal(name,'desktop_agent_document_catalog','This fixture has no document contents');return {data:[]};}},null,()=>assert.fail('This fixture must not import documents'));
};
