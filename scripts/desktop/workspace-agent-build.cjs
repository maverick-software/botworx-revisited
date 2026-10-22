// Read-only module redirection for existing regression tests. Shared build
// output and packaged app modules remain untouched.
const Module=require('node:module'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),shared=path.join(root,'desktop/build')+path.sep,isolated=path.join(root,'.supabase/desktop-workspace-agents/build')+path.sep,resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){let candidate=request;if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(shared))candidate=isolated+absolute.slice(shared.length);}return resolve.call(this,candidate,parent,...args);};
