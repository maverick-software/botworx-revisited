export const chromeConnectionId='f51d9d69-c827-4a9e-a683-47571984d7f7';
export const chromePluginName='chrome-devtools';
export type ChromeMode='existing'|'dedicated';
export type ChromeStatus={phase:'disconnected'|'connecting'|'connected'|'error';mode:ChromeMode;version:string;chromeFound:boolean;toolCount:number;error?:string};
