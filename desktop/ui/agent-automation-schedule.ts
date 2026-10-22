import type {TaskCadence} from '../src/scheduled-task-contracts';

export const automationInstructions='Follow your saved agent instructions and report the outcome of this scheduled run.';
export const automationIntervals=[15,30,60,120,180,240,300,360,420,480];
export const automationWeekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/** Only calendar expressions that this form can represent may enter the simple editor. */
export function automationDaily(cadence:TaskCadence):{days:number[];time:string;timezone:string}|null{
 if(cadence.kind!=='cron')return null;
 const fields=cadence.expression.trim().split(/\s+/);
 if(fields.length!==5||!/^\d{1,2}$/.test(fields[0])||!/^\d{1,2}$/.test(fields[1])||fields[2]!=='*'||fields[3]!=='*'||Number(fields[0])>59||Number(fields[1])>23)return null;
 const days=new Set<number>();
 if(fields[4]==='*')for(let day=0;day<7;day++)days.add(day);
 else for(const part of fields[4].split(',')){
  const match=/^([0-7])(?:-([0-7]))?$/.exec(part);if(!match)return null;
  const start=Number(match[1]),end=Number(match[2]??match[1]);if(end<start)return null;
  for(let day=start;day<=end;day++)days.add(day===7?0:day);
 }
 if(!days.size)return null;
 return {days:[...days].sort(),time:fields[1].padStart(2,'0')+':'+fields[0].padStart(2,'0'),timezone:cadence.timezone};
}

export function automationCadence(days:number[],time:string,timezone:string):TaskCadence{
 if(!days.length||days.some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Select at least one day.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose a valid run time.');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw Error('Choose a valid time zone.');}
 const [hour,minute]=time.split(':').map(Number),selected=[...new Set(days)].sort();
 return {kind:'cron',expression:minute+' '+hour+' * * '+(selected.length===7?'*':selected.join(',')),timezone};
}

export function automationZoneLabel(zone:string){
 const named:Record<string,string>={'America/Los_Angeles':'Pacific Time – Los Angeles','America/Denver':'Mountain Time – Denver','America/Chicago':'Central Time – Chicago','America/New_York':'Eastern Time – New York',UTC:'Coordinated Universal Time'};
 return Object.hasOwn(named,zone)?named[zone]:zone.replace(/_/g,' ').replace(/\//g,' – ');
}
