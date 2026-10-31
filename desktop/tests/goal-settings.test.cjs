const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {goalLimits,goalHasTurns,goalTurnLabel}=require(path.join(process.env.SYLVANA_GOAL_BUILD,'goal-settings.js'));
test('new goals default to unlimited and existing explicit limits retain their value',()=>{
 assert.deepEqual(goalLimits({}),{maxTurns:null,tokenBudget:null});assert.deepEqual(goalLimits({maxTurns:3}),{maxTurns:3,tokenBudget:null});assert.deepEqual(goalLimits({maxTurns:null,tokenBudget:40000}),{maxTurns:null,tokenBudget:40000});
 for(const maxTurns of [0,-1,1.5,'10',1001,Infinity])assert.throws(()=>goalLimits({maxTurns}));
 for(const tokenBudget of [0,-1,1.2,'100',Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>goalLimits({tokenBudget}));
 assert(goalHasTurns({max_turns:null,turns_used:121}));assert.equal(goalHasTurns({max_turns:12,turns_used:12}),false);assert.equal(goalTurnLabel({max_turns:null,turns_used:12}),'12 turns · No turn limit');
});
