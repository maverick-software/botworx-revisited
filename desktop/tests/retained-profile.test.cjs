const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),build=process.env.SYLVANA_PROFILE_TEST_BUILD||path.resolve(__dirname,'../build');
const {privateProfilePath}=require(path.join(build,'desktop-profile.js')),{WorkspaceFiles}=require(path.join(build,'workspace.js'));
test('retained Windows profiles stay protected after a different profile becomes active',()=>{
 const files=new WorkspaceFiles({get:()=>undefined,set:async()=>{}},undefined,['D:\\new-private-profile']);
 const roots=['C:\\Users\\Alice\\AppData\\Roaming\\Sylvana','C:\\Users\\Alice\\AppData\\Roaming\\Sylvana-before-12345678-1234-4123-8123-123456789abc','D:\\Profiles\\Bob\\AppData\\Local\\Packages\\Example.Host_family\\LocalCache\\Roaming\\Sylvana','C:\\Users\\Alice\\.sylvana\\desktop'];
 for(const root of roots)for(const value of [root,root.toUpperCase()+'\\Local State','\\\\?\\'+root+'\\credentials.bin',root+'\\codex\\state_5.sqlite']){assert(privateProfilePath(value),value);assert.throws(()=>files.checkPath(value),/cannot be attached/,value);}
 for(const value of ['D:\\Work\\Sylvana\\notes.md','C:\\Users\\Alice\\Documents\\Sylvana\\plan.md','C:\\Users\\Alice\\AppData\\Roaming\\Sylvana-project\\notes.md']){assert(!privateProfilePath(value));assert.doesNotThrow(()=>files.checkPath(value));}
});
