// Text snapshots share the existing bounded draft envelope with the typed message.
const snapshotActions=new Set(['chat.start','chat.queue.add','native.steer','drafts.save','composer.save','composer.new','goals.start','tasks.save']);
export function desktopRequestLimit(action:string){return snapshotActions.has(action)?2*1024**2:action==='agents.save'?850000:200000;}
