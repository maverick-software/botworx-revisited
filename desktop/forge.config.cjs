const path=require('node:path');
module.exports={
 packagerConfig:{asar:true,executableName:'Agentopia',name:'Agentopia',appBundleId:'local.agentopia.desktop',extraResource:[path.resolve(__dirname,'../resources')],prune:true},
 makers:[{name:'@electron-forge/maker-squirrel',config:{name:'AgentopiaDesktop',setupExe:'AgentopiaSetup.exe',description:'Agentopia private desktop workspace',authors:'Agentopia',noMsi:true}}],
};
