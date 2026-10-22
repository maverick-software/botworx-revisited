const test=require('node:test'),assert=require('node:assert/strict');
const {taskCadence,taskNext,taskDue}=require('../build/task-cadence.js');
const anchor='2026-01-01T00:00:00.000Z';
test('schedule input validates intervals, calendar fields, time zones and one-time dates',()=>{
 assert.deepEqual(taskCadence({kind:'interval',minutes:7,untrusted:'ignored'}),{kind:'interval',minutes:7});
 for(const minutes of [0,-1,1.1,10081,NaN,'5'])assert.throws(()=>taskCadence({kind:'interval',minutes}));
 for(const value of [null,[],{}, {kind:'cron',expression:'0 9 * * * *',timezone:'UTC'},{kind:'cron',expression:'99 99 * * *',timezone:'UTC'},{kind:'cron',expression:'0 9 * * *',timezone:'invalid/timezone'},{kind:'once',at:'never'}])assert.throws(()=>taskCadence(value));
 assert.deepEqual(taskCadence({kind:'once',at:'2026-01-01T09:00:00-08:00'}),{kind:'once',at:'2026-01-01T17:00:00.000Z'});
});
test('intervals stay anchored across hour boundaries and long periods offline',()=>{
 assert.equal(taskNext({kind:'interval',minutes:7},'2026-01-01T01:00:00Z',anchor),'2026-01-01T01:03:00.000Z');
 assert.equal(taskNext({kind:'interval',minutes:7},'2026-01-01T01:03:00Z',anchor),'2026-01-01T01:10:00.000Z');
 const next=taskNext({kind:'interval',minutes:7},'2027-01-01T00:00:00Z',anchor);assert((new Date(next)-new Date(anchor))%(7*60000)===0);assert(new Date(next)>new Date('2027-01-01'));
});
test('calendar daily runs retain 09:00 local time across both daylight-saving transitions',()=>{
 const cadence={kind:'cron',expression:'0 9 * * *',timezone:'America/Los_Angeles'};
 assert.equal(taskNext(cadence,'2026-03-07T17:00:00Z',anchor),'2026-03-08T16:00:00.000Z');
 assert.equal(taskNext(cadence,'2026-10-31T16:00:00Z',anchor),'2026-11-01T17:00:00.000Z');
});
test('weekday and monthly schedules advance to their next actual local occurrence',()=>{
 assert.equal(taskNext({kind:'cron',expression:'0 9 * * 1-5',timezone:'America/Los_Angeles'},'2026-10-16T16:00:00Z',anchor),'2026-10-19T16:00:00.000Z');
 assert.equal(taskNext({kind:'cron',expression:'0 9 1 * *',timezone:'UTC'},'2026-10-18T19:00:00Z',anchor),'2026-11-01T09:00:00.000Z');
});
test('one-time tasks have no further occurrence after their selected instant',()=>{
 const cadence={kind:'once',at:'2026-01-02T09:00:00.000Z'};
 assert.equal(taskNext(cadence,anchor,anchor),cadence.at);assert.equal(taskNext(cadence,cadence.at,anchor),null);
});
test('late-run policy distinguishes a short dispatch delay from a missed run without enumerating a backlog',()=>{
 const task={cadence:{kind:'interval',minutes:7},anchor,nextAt:'2026-01-01T00:07:00.000Z',missed:'skip'};
 assert.equal(taskDue(task,'2026-01-01T00:06:59Z'),null);assert.equal(taskDue(task,'2026-01-01T00:07:05Z').skip,false);
 assert.deepEqual(taskDue(task,'2026-01-01T01:00:00Z'),{due:task.nextAt,next:'2026-01-01T01:03:00.000Z',skip:true,missed:true});
 assert.equal(taskDue({...task,missed:'latest'},'2026-01-01T01:00:00Z').skip,false);
});
