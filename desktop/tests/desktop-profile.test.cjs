const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {packageCacheProfile,desktopProfile}=require(path.join(process.env.AGENTOPIA_PROFILE_TEST_BUILD||path.resolve(__dirname,'../build'),'desktop-profile.js'));
const appData='C:\\Users\\charl\\AppData\\Roaming',physical='C:\\Users\\charl\\AppData\\Local\\Packages\\OpenAI.Codex_2p2nqsd0c76g0\\LocalCache\\Local\\AgentopiaDesktop\\app-0.42.2\\Agentopia.exe',expected='C:\\Users\\charl\\AppData\\Local\\Packages\\OpenAI.Codex_2p2nqsd0c76g0\\LocalCache\\Roaming\\Agentopia';
test('a package-cached Agentopia executable selects the matching current-user Roaming profile',()=>{
 assert.equal(packageCacheProfile(physical,appData),expected);
 assert.equal(packageCacheProfile(physical.toLowerCase(),appData.toUpperCase()).toLowerCase(),expected.toLowerCase());
 assert.equal(packageCacheProfile('D:\\Profiles\\alice\\AppData\\Local\\Packages\\Example.Host_family\\LocalCache\\Local\\AgentopiaDesktop\\app-1.2.3\\Agentopia.exe','D:\\Profiles\\alice\\AppData\\Roaming'),'D:\\Profiles\\alice\\AppData\\Local\\Packages\\Example.Host_family\\LocalCache\\Roaming\\Agentopia');
});
test('normal installations, unrelated programs and another Windows user cannot redirect this profile',()=>{
 for(const exe of ['C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.42.2\\Agentopia.exe',physical.replace('Agentopia.exe','Other.exe'),physical.replace('app-0.42.2','other'),physical.replace('Users\\charl','Users\\other'),'\\\\server\\share'+physical.slice(2)])assert.equal(packageCacheProfile(exe,appData),undefined,exe);
});
test('profile selection resolves the physical executable before synchronously opening the original data directory',()=>{
 const calls=[],logical='C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.42.2\\Agentopia.exe';
 const selected=desktopProfile({platform:'win32',packaged:true,testProfile:false,exe:logical,appData,current:appData+'\\Agentopia'},{realpath:value=>{calls.push(['resolve',value]);return physical;},mkdir:value=>calls.push(['mkdir',value])});
 assert.equal(selected,expected);assert.deepEqual(calls,[['resolve',logical],['mkdir',expected]]);assert.equal(typeof selected,'string');
});
test('development, explicit test profiles and other platforms retain their profile without filesystem changes; failures remain visible',()=>{
 const base={platform:'win32',packaged:true,testProfile:false,exe:physical,appData,current:appData+'\\Agentopia'},io={realpath:()=>{throw new Error('Unexpected filesystem access');},mkdir:()=>{throw new Error('Unexpected creation');}};
 for(const patch of [{packaged:false},{testProfile:true},{platform:'linux'}])assert.equal(desktopProfile({...base,...patch},io),base.current);
 assert.throws(()=>desktopProfile(base,{realpath:()=>{throw new Error('Access denied');},mkdir:()=>{}}),/Access denied/);
 assert.throws(()=>desktopProfile(base,{realpath:()=>physical,mkdir:()=>{throw new Error('Profile unavailable');}}),/Profile unavailable/);
});
