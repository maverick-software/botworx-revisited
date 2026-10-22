export type CompletionNotificationMode='never'|'unfocused'|'always';
export type NotificationPreferences={completion:CompletionNotificationMode;permissions:boolean;questions:boolean;tasks:boolean};
export const defaultNotificationPreferences:NotificationPreferences={completion:'unfocused',permissions:true,questions:true,tasks:true};
export function notificationPreferences(value:unknown):NotificationPreferences{
 const invalid=()=>{throw Error('Choose valid notification modes and alert settings.');};
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
 const input=value as Record<string,unknown>,keys=Object.keys(input).sort().join(',');
 // Releases through 0.44.49 saved two booleans. Preserve those choices on read.
 if(keys==='responses,tasks'&&typeof input.responses==='boolean'&&typeof input.tasks==='boolean')return {completion:input.responses?'unfocused':'never',permissions:input.responses,questions:input.responses,tasks:input.tasks};
 if(keys!=='completion,permissions,questions,tasks'||!['never','unfocused','always'].includes(input.completion as string)||typeof input.permissions!=='boolean'||typeof input.questions!=='boolean'||typeof input.tasks!=='boolean')return invalid();
 return {completion:input.completion as CompletionNotificationMode,permissions:input.permissions,questions:input.questions,tasks:input.tasks};
}
export type NotificationStore={get:<T>(key:string)=>T|undefined;set:(key:string,value:unknown)=>Promise<void>};
export function readNotificationPreferences(store:Pick<NotificationStore,'get'>,owner:string){return notificationPreferences(store.get('notification-preferences:'+owner)??defaultNotificationPreferences);}
