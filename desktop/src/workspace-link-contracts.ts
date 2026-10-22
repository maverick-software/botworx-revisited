export type WorkspaceLink={kind:'web';url:string}|{kind:'anchor';fragment:string}|{kind:'file'|'folder';referenceId:string;path:string;name:string;fragment?:string};
