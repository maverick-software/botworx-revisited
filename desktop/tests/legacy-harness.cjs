// Existing adapter fixtures exercise the preserved custom engine explicitly.
// Native runtime behavior is verified separately against app-server and live providers.
const original=require('../build/broker.js');
class Broker extends original.Broker{
 call(action,args={}){return super.call(action,['chat.start','goals.start'].includes(action)?{...args,options:{...args.options,harness:'legacy'}}:args);}
}
module.exports={...original,Broker};
