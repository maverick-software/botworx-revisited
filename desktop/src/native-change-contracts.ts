export type NativeChangePath={path:string;referenceId:string;relativePath:string;before:string|null;after:string|null;beforeHash:string|null;afterHash:string|null;restorePath?:string};
export type NativeChangeReceipt={id:string;key:string;status:'ready'|'restoring'|'restored'|'uncertain';paths:NativeChangePath[];available?:boolean;error?:string};
export type NativeChangeReview={receipts:NativeChangeReceipt[];issues:{key:string;error:string}[]};
