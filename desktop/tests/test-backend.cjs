const {writeFileSync}=require('node:fs'),path=require('node:path');
const {legacyDistribution,parseRuntimeBinding}=require('../build/runtime-binding.js');
function testDistribution(env=process.env){
 const distribution=env.AGENTOPIA_TEST_DISTRIBUTION??legacyDistribution;
 if(distribution!==legacyDistribution)parseRuntimeBinding({format:1,distribution,instanceId:distribution.slice(legacyDistribution.length+1)});
 return distribution;
}
function bindTestRuntime(directory){const distribution=testDistribution();if(distribution!==legacyDistribution)writeFileSync(path.join(directory,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:distribution.slice(legacyDistribution.length+1)}),{flag:'wx'});}
module.exports={testDistribution,bindTestRuntime};
