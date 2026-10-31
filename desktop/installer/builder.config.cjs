const path=require('node:path');
const input=process.env.SYLVANA_WIZARD_INPUT,output=process.env.SYLVANA_WIZARD_OUTPUT;
if(!input||!output)throw Error('Set SYLVANA_WIZARD_INPUT and SYLVANA_WIZARD_OUTPUT to qualified F-drive paths.');
const verification=process.env.SYLVANA_WIZARD_VERIFICATION==='1';
if(verification&&!process.env.SYLVANA_WIZARD_TEST_HOME)throw Error('An isolated verification home is required.');
module.exports={
 appId:verification?'com.sylvana.setup.verification':'com.squirrel.SylvanaDesktop.Sylvana',
 productName:verification?'Sylvana Setup Verification':'Sylvana',
 executableName:'Sylvana',
 directories:{output,buildResources:path.join(__dirname,'assets')},
 electronVersion:'44.7.2',
 toolsets:{nsis:'1.2.1'},
 publish:null,
 compression:'normal',
 protocols:verification?[]:[{name:'Sylvana browser sign-in',schemes:['sylvana']}],
 win:{target:[{target:'nsis',arch:['x64']}],signAndEditExecutable:false,artifactName:verification?'SylvanaSetup-Verification.exe':'SylvanaSetup.exe'},
 nsis:{oneClick:false,allowToChangeInstallationDirectory:true,allowElevation:false,packElevateHelper:false,perMachine:false,selectPerMachineByDefault:false,deleteAppDataOnUninstall:false,runAfterFinish:!verification,createDesktopShortcut:!verification,createStartMenuShortcut:!verification,differentialPackage:false,preCompressedFileExtensions:['.gz'],include:path.join(output,'wizard-include.nsh'),installerLanguages:['en_US'],warningsAsErrors:true},
 extraMetadata:{version:process.env.SYLVANA_WIZARD_VERSION??'0.46.2',author:'Sylvana',description:'Sylvana private desktop workspace'},
 beforeBuild:async()=>{throw Error('Use --prepackaged with the qualified program tree; rebuilding from unrelated working files is prohibited.');},
};
