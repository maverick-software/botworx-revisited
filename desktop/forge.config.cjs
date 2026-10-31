const path=require('node:path');
module.exports={
 packagerConfig:{asar:true,executableName:'Sylvana',name:'Sylvana',appBundleId:'local.sylvana.desktop',extraResource:[process.env.SYLVANA_PACKAGE_RESOURCES??path.resolve(__dirname,'../resources')],prune:true},
 makers:[{name:'@electron-forge/maker-squirrel',config:{name:'SylvanaDesktop',setupExe:'SylvanaSetup.exe',description:'Sylvana private desktop workspace',authors:'Sylvana',noMsi:true,additionalFiles:[{src:'LICENSES.chromium.html',target:'lib\\net45\\LICENSES.chromium.html'},{src:'version',target:'lib\\net45\\version'}]}}],
};
