import {dialog,type OpenDialogOptions} from 'electron';
import {readPluginSource} from './plugin-import';
type Picker={showOpenDialog:(options:OpenDialogOptions)=>Promise<{canceled:boolean;filePaths:string[]}>};
export async function pickPluginSource(kind:unknown,guard:()=>Promise<void>,checkPath:(file:string)=>void,picker:Picker={showOpenDialog:options=>dialog.showOpenDialog(options)}){
 if(kind!=='file'&&kind!=='folder')throw new Error('Choose a plugin file or folder.');await guard();
 const selected=await picker.showOpenDialog({title:kind==='folder'?'Choose plugin folder':'Choose plugin package',properties:[kind==='folder'?'openDirectory':'openFile'],...(kind==='file'?{filters:[{name:'Plugin packages',extensions:['zip','json']}]}:{})});
 await guard();if(selected.canceled)return null;if(selected.filePaths.length!==1)throw new Error('Choose one plugin package.');const result=await readPluginSource(selected.filePaths[0],kind,guard,checkPath);await guard();return {...result,notice:'Schema validation checks structure and host support. It does not certify the publisher or server.'};
}
