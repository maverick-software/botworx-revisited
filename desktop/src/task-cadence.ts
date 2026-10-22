import {Cron} from 'croner';
import type {TaskCadence} from './scheduled-task-contracts';

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose a schedule.');return value as Record<string,unknown>;}
function instant(value:string){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('The schedule has an invalid time.');return date;}
export function taskCadence(value:unknown):TaskCadence{
 const input=object(value);
 if(input.kind==='once'){if(typeof input.at!=='string')throw Error('Choose when the task should run.');return {kind:'once',at:instant(input.at).toISOString()};}
 if(input.kind==='interval'){
  if(!Number.isInteger(input.minutes)||(input.minutes as number)<1||(input.minutes as number)>10080)throw Error('Choose an interval from one minute to seven days.');
  return {kind:'interval',minutes:input.minutes as number};
 }
 if(input.kind!=='cron'||typeof input.expression!=='string'||typeof input.timezone!=='string')throw Error('Choose an interval or calendar schedule.');
 const expression=input.expression.trim(),timezone=input.timezone.trim();
 if(expression.length>200||expression.split(/\s+/).length!==5)throw Error('Enter a five-field calendar schedule.');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw Error('Choose a valid time zone.');}
 try{new Cron(expression,{paused:true,timezone}).stop();}catch{throw Error('Enter a valid five-field calendar schedule.');}
 return {kind:'cron',expression,timezone};
}

/** Interval schedules use their saved UTC anchor; they do not reset at the hour.
 * Calendar schedules use the pinned Croner's time-zone and DST rules. */
export function taskNext(cadence:TaskCadence,after:string,anchor:string):string|null{
 const checked=taskCadence(cadence),time=instant(after),origin=instant(anchor);
 if(checked.kind==='once')return instant(checked.at)>time?checked.at:null;
 if(checked.kind==='interval'){
  const period=checked.minutes*60000,index=Math.max(1,Math.floor((time.getTime()-origin.getTime())/period)+1),next=origin.getTime()+index*period;
  if(!Number.isSafeInteger(next)||Math.abs(next)>8640000000000000)throw Error('The next scheduled time is out of range.');
  return new Date(next).toISOString();
 }
 const job=new Cron(checked.expression,{paused:true,timezone:checked.timezone});try{return job.nextRun(time)?.toISOString()??null;}finally{job.stop();}
}

export function taskDue(task:{cadence:TaskCadence;anchor:string;nextAt:string|null;missed:'skip'|'latest'},now:string,graceMs=60000){
 if(!task.nextAt)return null;const current=instant(now),due=instant(task.nextAt);if(due>current)return null;
 if(!Number.isFinite(graceMs)||graceMs<0)throw Error('Invalid schedule dispatch tolerance.');
 const missed=current.getTime()-due.getTime()>graceMs;
 return {due:due.toISOString(),next:taskNext(task.cadence,now,task.anchor),skip:missed&&task.missed==='skip',missed};
}
