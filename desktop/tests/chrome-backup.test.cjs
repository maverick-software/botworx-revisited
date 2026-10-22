const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const {chromeBackupEntry}=require('../build/runtime.js');
test('Chrome recovery copies include saved artifacts and exclude profile sign-ins and temporary upload contents',()=>{
 const root=path.resolve('chrome-backup'),owner=path.join(root,'12345678-1234-4123-8123-123456789abc');
 for(const file of [root,owner,path.join(owner,'artifacts'),path.join(owner,'artifacts','conversation','page.jpeg')])assert(chromeBackupEntry(root,file),file);
 for(const file of [path.join(owner,'profile'),path.join(owner,'profile','Default','Cookies'),path.join(owner,'private-inputs'),path.join(owner,'private-inputs','operation','file.txt'),path.resolve(root,'..','outside'),path.join(root,'unexpected-owner','artifacts')])assert(!chromeBackupEntry(root,file),file);
});
