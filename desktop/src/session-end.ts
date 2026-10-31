export const sessionEndedTag='[sylvana-local-session-ended]';
export class LocalSessionEnded extends Error{constructor(message='Sign in to Sylvana to continue.'){super(sessionEndedTag+' '+message);this.name='LocalSessionEnded';}}
export const localSessionEnded=(error:unknown)=>String((error as Error)?.message??error).includes(sessionEndedTag);
export function rejectedLocalSession(error:unknown){const e=error as {code?:string;status?:number};return !!e&&typeof e.status==='number'&&e.status>=400&&e.status<500&&['refresh_token_already_used','refresh_token_not_found','session_not_found','session_expired','user_not_found','bad_jwt'].includes(e.code??'');}
/** A failed request from an older authentication must not dismiss a newer login. */
export class SessionEndBoundary{
 private current?:{epoch:()=>number;ended:()=>void};
 listen(epoch:()=>number,ended:()=>void){const listener={epoch,ended};this.current=listener;return()=>{if(this.current===listener)this.current=undefined;};}
 request(){const listener=this.current,epoch=listener?.epoch();return(error:unknown)=>{if(localSessionEnded(error)&&listener&&this.current===listener&&epoch===listener.epoch())listener.ended();};}
}
